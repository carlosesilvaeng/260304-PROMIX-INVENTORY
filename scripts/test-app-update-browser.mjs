// Standalone real-browser fixture. No production accounts or API calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PROMIX_PLAYWRIGHT_MODULE || 'playwright');
const bundle = await build({
  stdin: { contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {useApplicationUpdate,AppUpdateNotice} from './src/app/components/AppUpdateNotice';
    import {beginUpdateProtectedPhoto} from './src/app/utils/appUpdate';
    window.startPhoto=beginUpdateProtectedPhoto;
    window.props={account:'operator',authLoading:false,pending:false,loading:false};
    function Fixture(){const update=useApplicationUpdate(window.props);return <><p>{update.checking?'Checking':'Ready'}</p><AppUpdateNotice update={update}/></>}
    const root=createRoot(document.getElementById('root'));
    window.renderProps=(props)=>{Object.assign(window.props,props);root.render(<Fixture/>)};
    window.renderProps({});
  `, loader: 'tsx', resolveDir: process.cwd() },
  bundle: true, format: 'esm', write: false, logLevel: 'silent',
  define: { __PROMIX_BUILD_ID__: JSON.stringify('old'), 'import.meta.env.PROD': 'true' },
});
let published = 'old';
let unavailable = false;
const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.url.startsWith('/app-version.json')) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = unavailable ? 503 : 200;
    res.end(JSON.stringify({buildId:published}));
  } else if (req.url === '/fixture.js') {
    res.setHeader('Content-Type','text/javascript'); res.end(bundle.outputFiles[0].text);
  } else res.end('<!doctype html><div id="root"></div><script type="module" src="/fixture.js"></script>');
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext({viewport:{width:390,height:844}});
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByText('Ready',{exact:true}).waitFor();
  await page.evaluate(() => { localStorage.setItem('draft-sentinel','preserved'); window.renderProps({pending:true}); });
  published = 'new';
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  const button = page.getByRole('button',{name:'Actualizar ahora'});
  await button.waitFor();
  assert.equal(await button.isDisabled(), true);
  await page.evaluate(() => { window.finishPhoto=window.startPhoto(); window.renderProps({pending:false}); });
  assert.equal(await button.isDisabled(), true);
  await page.evaluate(() => window.finishPhoto());
  await page.waitForFunction(() => !document.querySelector('button').disabled);
  await button.click();
  await page.waitForURL(/promix_update=new/);
  await page.getByText('Ready',{exact:true}).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('draft-sentinel')), 'preserved');
  console.log('Mobile capture: pending drafts and active photos block reload; confirmed save enables update; storage preserved.');
  // Simulate an old document being returned even after the fresh navigation.
  const login = await context.newPage();
  let navigations = 0;
  login.on('framenavigated', frame => { if (frame === login.mainFrame()) navigations++; });
  await login.goto(origin);
  await login.waitForURL(/promix_update=new/);
  await login.getByText('Ready',{exact:true}).waitFor();
  assert.equal(navigations, 2);
  console.log('Login automatically updates once; a stale document cannot create a reload loop.');
  unavailable = true;
  const offline = await context.newPage();
  await offline.goto(origin);
  await offline.getByText('Ready',{exact:true}).waitFor();
  assert.equal(await offline.getByRole('button',{name:'Actualizar ahora'}).count(), 0);
  console.log('Unavailable version service does not block login.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
