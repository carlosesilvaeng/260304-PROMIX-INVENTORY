import React, { useState, useEffect } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Alert } from '../../components/Alert';
import { useAuth } from '../../contexts/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { UserPlus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface User {
  id: string;
  name: string;
  email: string;
  role: 'plant_manager' | 'admin' | 'super_admin';
  assigned_plants: string[];
  is_active: boolean;
  auth_user_id?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

interface CreateUserFormData {
  name: string;
  email: string;
  password: string;
  role: 'plant_manager' | 'admin' | 'super_admin';
  assigned_plants: string[];
}

interface EditUserFormData {
  name: string;
  role: 'plant_manager' | 'admin' | 'super_admin';
  assigned_plants: string[];
  is_active: boolean;
}

// ============================================================================
// API HELPER
// ============================================================================

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server`;

async function callAPI(endpoint: string, method: string = 'GET', body?: any, token?: string) {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || publicAnonKey}`,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  console.log('[callAPI] Request:', { endpoint, method, hasBody: !!body, hasToken: !!token });

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  
  console.log('[callAPI] Response status:', response.status, response.statusText);
  
  let data;
  try {
    data = await response.json();
    console.log('[callAPI] Response data:', data);
  } catch (e) {
    console.error('[callAPI] Failed to parse JSON response:', e);
    throw new Error(`Error del servidor (HTTP ${response.status}): No se pudo parsear la respuesta`);
  }

  if (!response.ok) {
    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      errorMessage: data.error || 'Error en la solicitud',
      fullResponse: data,
    };
    console.error('[callAPI] Request failed:', errorDetails);
    
    // Throw error with details attached
    const error = new Error(data.error || 'Error en la solicitud');
    (error as any).details = errorDetails;
    throw error;
  }

  return data;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UserManagement() {
  const { user: currentUser, accessToken, allPlants } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form data
  const [createForm, setCreateForm] = useState<CreateUserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'plant_manager',
    assigned_plants: [],
  });

  const [editForm, setEditForm] = useState<EditUserFormData>({
    name: '',
    role: 'plant_manager',
    assigned_plants: [],
    is_active: true,
  });

  // ============================================================================
  // LOAD USERS
  // ============================================================================

  const loadUsers = async () => {
    if (!currentUser || !accessToken) {
      console.error('[UserManagement] Missing auth data:', { 
        hasUser: !!currentUser, 
        hasToken: !!accessToken 
      });
      setError('No hay sesión activa. Por favor, cierra sesión y vuelve a entrar.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    console.log('[UserManagement] Loading users with token:', accessToken?.substring(0, 20) + '...');

    try {
      const response = await callAPI('/auth/users', 'GET', null, accessToken);
      
      if (response.success && response.users) {
        const visibleUsers = currentUser?.role === 'super_admin'
          ? response.users
          : response.users.filter((loadedUser: User) => loadedUser.role !== 'super_admin');

        setUsers(visibleUsers);
        console.log('[UserManagement] Loaded', visibleUsers.length, 'users');
      } else {
        setError(response.error || 'Error al cargar usuarios');
        console.error('[UserManagement] Error response:', response);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Error al cargar usuarios';
      setError(errorMsg);

      console.error('[UserManagement] Error loading users:', err);
      console.error('[UserManagement] Error details:', err.details);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser, accessToken]);

  // ============================================================================
  // CREATE USER
  // ============================================================================

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await callAPI('/auth/signup', 'POST', {
        ...createForm,
        created_by_id: currentUser?.id,
      }, accessToken);

      if (response.success) {
        setSuccess('Usuario creado exitosamente');
        setShowCreateModal(false);
        setCreateForm({
          name: '',
          email: '',
          password: '',
          role: 'plant_manager',
          assigned_plants: [],
        });
        loadUsers(); // Recargar lista
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Error al crear usuario');
      }
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario');
      console.error('Error creating user:', err);
    }
  };

  // ============================================================================
  // EDIT USER
  // ============================================================================

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      role: user.role,
      assigned_plants: user.assigned_plants,
      is_active: user.is_active,
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setError('');
    setSuccess('');

    try {
      const response = await callAPI(`/auth/users/${selectedUser.id}`, 'PUT', editForm, accessToken);

      if (response.success) {
        setSuccess('Usuario actualizado exitosamente');
        setShowEditModal(false);
        setSelectedUser(null);
        loadUsers(); // Recargar lista
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Error al actualizar usuario');
      }
    } catch (err: any) {
      setError(err.message || 'Error al actualizar usuario');
      console.error('Error updating user:', err);
    }
  };

  // ============================================================================
  // DELETE USER
  // ============================================================================

  const handleOpenDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setError('');
    setSuccess('');

    try {
      const response = await callAPI(`/auth/users/${selectedUser.id}`, 'DELETE', null, accessToken);

      if (response.success) {
        setSuccess('Usuario eliminado exitosamente');
        setShowDeleteConfirm(false);
        setSelectedUser(null);
        loadUsers(); // Recargar lista
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error || 'Error al eliminar usuario');
      }
    } catch (err: any) {
      setError(err.message || 'Error al eliminar usuario');
      console.error('Error deleting user:', err);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-700 border border-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-700 border border-blue-300';
      case 'plant_manager':
        return 'bg-green-100 text-green-700 border border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Administrador';
      case 'admin':
        return 'Administrador';
      case 'plant_manager':
        return 'Gerente de Planta';
      default:
        return role;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ============================================================================
  // PERMISSION CHECK
  // ============================================================================

  if (currentUser?.role !== 'super_admin' && currentUser?.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert 
          type="warning" 
          message="Solo Administradores pueden gestionar usuarios" 
        />
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-[#3B3A36]">Gestión de Usuarios</h3>
          <p className="text-sm text-[#5F6773] mt-1">
            Crear, editar y administrar usuarios operativos del sistema
          </p>
          <p className="text-xs text-[#9D9B9A] mt-1">
            Solo el Super Administrador puede ver y crear usuarios con rol de Super Administrador.
          </p>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => setShowCreateModal(true)}
          icon={<UserPlus className="w-4 h-4" />}
        >
          Nuevo Usuario
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert type="error" message={error} onClose={() => setError('')} />
      )}
      {success && (
        <Alert type="success" message={success} onClose={() => setSuccess('')} />
      )}

      {/* Users Table */}
      {loading ? (
        <Card>
          <div className="text-center py-8 text-[#5F6773]">
            Cargando usuarios...
          </div>
        </Card>
      ) : users.length === 0 ? (
        <Card>
          <div className="text-center py-8 text-[#5F6773]">
            No hay usuarios registrados
          </div>
        </Card>
      ) : (() => {
        return users.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-[#5F6773]">
              No hay usuarios registrados
            </div>
          </Card>
        ) : (
          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#3B3A36] text-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Nombre</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Rol</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold">Plantas Asignadas</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold">Estado</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold">Último Login</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E4]">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-[#F2F3F5] transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-[#3B3A36]">{user.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#5F6773]">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[#5F6773]">
                          {user.assigned_plants.length === 0 ? (
                            <span className="text-[#9D9B9A]">Ninguna</span>
                          ) : user.assigned_plants.length > 3 ? (
                            <span>{user.assigned_plants.length} plantas</span>
                          ) : (
                            user.assigned_plants.join(', ')
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user.is_active ? (
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Activo
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-xs text-[#5F6773]">
                          {formatDate(user.last_login_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                            title="Editar usuario"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(user)}
                            className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                            title="Eliminar usuario"
                            disabled={user.id === currentUser?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })()}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E4E4E4] flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-[#3B3A36]">Crear Nuevo Usuario</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-[#F2F3F5] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <Input
                label="Nombre Completo"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                placeholder="Ej: Juan Pérez"
              />

              <Input
                label="Email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
                placeholder="usuario@promixpr.com"
              />

              <Input
                label="Contraseña"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                required
                placeholder="Mínimo 8 caracteres"
                helperText="El usuario deberá cambiar su contraseña en el primer login"
              />

              <Select
                label="Rol"
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                required
              >
                <option value="plant_manager">Gerente de Planta</option>
                <option value="admin">Administrador</option>
                {/* Solo Super Admin puede crear otros Super Admin */}
                {currentUser?.role === 'super_admin' && (
                  <option value="super_admin">Super Administrador</option>
                )}
              </Select>

              {createForm.role === 'plant_manager' && (
                <div>
                  <label className="block text-sm font-medium text-[#3B3A36] mb-2">
                    Plantas Asignadas
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(allPlants || []).filter(p => p.isActive).map((plant) => (
                      <label key={plant.id} className="flex items-center gap-2 p-2 border border-[#E4E4E4] rounded hover:bg-[#F2F3F5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createForm.assigned_plants.includes(plant.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateForm({
                                ...createForm,
                                assigned_plants: [...createForm.assigned_plants, plant.id]
                              });
                            } else {
                              setCreateForm({
                                ...createForm,
                                assigned_plants: createForm.assigned_plants.filter(id => id !== plant.id)
                              });
                            }
                          }}
                          className="rounded border-[#9D9B9A]"
                        />
                        <span className="text-sm text-[#3B3A36]">{plant.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  Crear Usuario
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#E4E4E4] flex justify-between items-center sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-[#3B3A36]">Editar Usuario</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-[#F2F3F5] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <Input
                label="Nombre Completo"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />

              <div>
                <label className="block text-sm font-medium text-[#3B3A36] mb-1">
                  Email
                </label>
                <div className="text-sm text-[#5F6773] bg-[#F2F3F5] p-3 rounded border border-[#E4E4E4]">
                  {selectedUser.email}
                </div>
                <p className="text-xs text-[#9D9B9A] mt-1">El email no se puede modificar</p>
              </div>

              <Select
                label="Rol"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                required
              >
                <option value="plant_manager">Gerente de Planta</option>
                <option value="admin">Administrador</option>
                {/* Solo Super Admin puede crear otros Super Admin */}
                {currentUser?.role === 'super_admin' && (
                  <option value="super_admin">Super Administrador</option>
                )}
              </Select>

              {editForm.role === 'plant_manager' && (
                <div>
                  <label className="block text-sm font-medium text-[#3B3A36] mb-2">
                    Plantas Asignadas
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(allPlants || []).filter(p => p.isActive).map((plant) => (
                      <label key={plant.id} className="flex items-center gap-2 p-2 border border-[#E4E4E4] rounded hover:bg-[#F2F3F5] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.assigned_plants.includes(plant.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditForm({
                                ...editForm,
                                assigned_plants: [...editForm.assigned_plants, plant.id]
                              });
                            } else {
                              setEditForm({
                                ...editForm,
                                assigned_plants: editForm.assigned_plants.filter(id => id !== plant.id)
                              });
                            }
                          }}
                          className="rounded border-[#9D9B9A]"
                        />
                        <span className="text-sm text-[#3B3A36]">{plant.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 p-3 border border-[#E4E4E4] rounded hover:bg-[#F2F3F5] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="rounded border-[#9D9B9A]"
                  />
                  <span className="text-sm font-medium text-[#3B3A36]">Usuario Activo</span>
                </label>
                <p className="text-xs text-[#9D9B9A] mt-1">
                  Los usuarios inactivos no podrán iniciar sesión
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  Guardar Cambios
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-[#3B3A36]">Eliminar Usuario</h3>
              </div>

              <p className="text-sm text-[#5F6773] mb-4">
                ¿Estás seguro que deseas eliminar al usuario <strong>{selectedUser.name}</strong>?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-6">
                <p className="text-xs text-red-700">
                  ⚠️ Esta acción no se puede deshacer. El usuario será eliminado permanentemente del sistema.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleDeleteUser}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Eliminar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
