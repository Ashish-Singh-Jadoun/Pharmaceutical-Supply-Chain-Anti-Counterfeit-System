# MedLedger — Pharmaceutical Supply Chain & Anti-Counterfeit System

A browser-based frontend major-project demo built with HTML, CSS, and vanilla JavaScript. It models medicine batches moving through manufacturers, distributors, pharmacies, customers, and regulators, with batch provenance, QR-code verification, cold-chain monitoring, recalls, and analytics.

## Run the project

No build step, dependencies, API keys, or backend are required.

1. Open `index.html` in a modern browser.
2. For camera QR scanning, run a local server (camera access generally requires localhost or HTTPS):

   ```sh
   python -m http.server 8080
   ```

3. Visit `http://localhost:8080/pharma-chain-project/` if you start the server from the parent folder, or `http://localhost:8080/` if you start it inside this folder.

## Demo features

- Role selector for regulator, manufacturer, distributor, pharmacist, and customer views.
- Supply-chain dashboard with activity, delivery, cold-chain, and alert summaries.
- Batch registration, filtering, CSV export, and a tamper-evident-style journey timeline.
- Medicine verification by batch ID; camera QR scanning uses the bundled local QR decoder when the browser lacks native QR detection (camera permissions and localhost/HTTPS are required).
- Simulated sensor readings, safe-range alerts, and temperature-history chart.
- Recall initiation, batch flagging, and recall resolution.
- Analytics and network-health views.
- Browser `localStorage` persistence, plus a reset option under the help button.
- Role-scoped workspaces: regulators see all records and control recalls/sensor simulations; manufacturers register and view their own batches; distributors see assigned routes; pharmacists see pharmacy-bound records and notices; customers can verify products without seeing private custody history.
- Temperature history is graphed per selected batch, uses that product's own safe range, expands its scale for out-of-range readings, and marks excursions in red.

## Important limitations

This is a frontend-only demonstration. The REST-like methods in `api.js` are an asynchronous mock API backed by browser `localStorage`; ledger hashes and network metrics are illustrative. QR decoding is bundled from jsQR (Apache-2.0; see `vendor/jsQR-LICENSE.txt`). The role switcher and page-level permissions demonstrate least-privilege UX only; they are not authentication or a security boundary. A real deployment must authenticate users and enforce organization/role permissions, audit access, and validate every operation on its server/API. No live blockchain, external medicine database, IoT sensor, authenticated organization, or real medical service is connected. Do not use this demo for clinical or regulatory decisions.
