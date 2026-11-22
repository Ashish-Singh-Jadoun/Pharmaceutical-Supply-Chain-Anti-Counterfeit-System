/* Demo API: async REST-like methods backed by localStorage. This is not a live blockchain. */
(function () {
  const STORAGE_KEY = "medledger-demo-v1";
  const now = Date.now();
  const hoursAgo = (hours) => new Date(now - hours * 3600000).toISOString();
  const temperatureBounds = (range) => {
    const match = String(range).match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/);
    return match ? [Number(match[1]), Number(match[2])] : [2, 8];
  };
  const initialData = {
    batches: [
      { id: "MED-2025-0842", product: "Amoxicillin 500mg", generic: "Amoxicillin", manufacturer: "Novartis Pharma", quantity: 24000, unit: "capsules", status: "In transit", location: "Frankfurt Distribution Hub", destination: "Central Pharmacy, Berlin", temperature: 4.8, range: "2–8°C", updated: hoursAgo(1), expiry: "2027-08-14", hash: "0x8f2a...c941", events: [{ title: "Batch manufactured", place: "Novartis Pharma · Basel, CH", time: hoursAgo(116), actor: "Manufacturer", hash: "0x6bb2...aa73" }, { title: "Quality inspection passed", place: "Novartis Pharma · Basel, CH", time: hoursAgo(110), actor: "Quality assurance", hash: "0x40de...182c" }, { title: "Dispatched to distributor", place: "Basel Logistics Center", time: hoursAgo(70), actor: "Manufacturer", hash: "0x9acf...a821" }, { title: "Received at distribution hub", place: "Frankfurt Distribution Hub", time: hoursAgo(13), actor: "Distributor", hash: "0x8f2a...c941" }] },
      { id: "MED-2025-0841", product: "Insulin Glargine 100 IU", generic: "Insulin glargine", manufacturer: "Novo Nordisk", quantity: 8200, unit: "pens", status: "Temperature alert", location: "Rotterdam Cold Storage", destination: "CityCare Pharmacy, Amsterdam", temperature: 9.4, range: "2–8°C", updated: hoursAgo(0.2), expiry: "2026-11-02", hash: "0x31c8...f42d", events: [{ title: "Batch manufactured", place: "Novo Nordisk · Bagsværd, DK", time: hoursAgo(75), actor: "Manufacturer", hash: "0xda11...7d93" }, { title: "Quality inspection passed", place: "Novo Nordisk · Bagsværd, DK", time: hoursAgo(71), actor: "Quality assurance", hash: "0x21c3...f080" }, { title: "Cold-chain alert detected", place: "Rotterdam Cold Storage", time: hoursAgo(0.2), actor: "IoT sensor", hash: "0x31c8...f42d" }] },
      { id: "MED-2025-0839", product: "Metformin 850mg", generic: "Metformin", manufacturer: "Pfizer", quantity: 15600, unit: "tablets", status: "Delivered", location: "Central Pharmacy, Berlin", destination: "Central Pharmacy, Berlin", temperature: 20.2, range: "15–25°C", updated: hoursAgo(4), expiry: "2028-02-20", hash: "0x7d1b...b55a", events: [{ title: "Batch manufactured", place: "Pfizer · Freiburg, DE", time: hoursAgo(192), actor: "Manufacturer", hash: "0x55c2...a008" }, { title: "Dispatched to distributor", place: "Freiburg Logistics Center", time: hoursAgo(100), actor: "Manufacturer", hash: "0x19f7...bb11" }, { title: "Received by pharmacy", place: "Central Pharmacy, Berlin", time: hoursAgo(4), actor: "Pharmacist", hash: "0x7d1b...b55a" }] },
      { id: "MED-2025-0837", product: "Atorvastatin 20mg", generic: "Atorvastatin", manufacturer: "AstraZeneca", quantity: 11800, unit: "tablets", status: "In transit", location: "Hamburg Transit Center", destination: "Northside Pharmacy, Hamburg", temperature: 20.1, range: "15–25°C", updated: hoursAgo(2), expiry: "2027-03-19", hash: "0x5ca4...180e", events: [{ title: "Batch manufactured", place: "AstraZeneca · Gothenburg, SE", time: hoursAgo(144), actor: "Manufacturer", hash: "0xc161...1a48" }, { title: "Dispatched to distributor", place: "Gothenburg Logistics Center", time: hoursAgo(49), actor: "Manufacturer", hash: "0x47ac...322b" }, { title: "Departed transit center", place: "Hamburg Transit Center", time: hoursAgo(2), actor: "Distributor", hash: "0x5ca4...180e" }] },
      { id: "MED-2025-0835", product: "Adalimumab 40mg", generic: "Adalimumab", manufacturer: "AbbVie", quantity: 1400, unit: "syringes", status: "Delivered", location: "University Hospital Pharmacy", destination: "University Hospital Pharmacy", temperature: 3.9, range: "2–8°C", updated: hoursAgo(8), expiry: "2026-09-11", hash: "0xa18d...c20f", events: [{ title: "Batch manufactured", place: "AbbVie · Ludwigshafen, DE", time: hoursAgo(220), actor: "Manufacturer", hash: "0x0081...2d47" }, { title: "Cold-chain verified", place: "Frankfurt Distribution Hub", time: hoursAgo(56), actor: "IoT sensor", hash: "0x167b...3c19" }, { title: "Received by pharmacy", place: "University Hospital Pharmacy", time: hoursAgo(8), actor: "Pharmacist", hash: "0xa18d...c20f" }] },
      { id: "MED-2025-0832", product: "EpiPen 0.3mg", generic: "Epinephrine", manufacturer: "Viatris", quantity: 5600, unit: "auto-injectors", status: "Quality review", location: "Munich Quality Lab", destination: "Bavaria Regional Pharmacy", temperature: 6.1, range: "2–8°C", updated: hoursAgo(7), expiry: "2027-12-03", hash: "0x95c1...6240", events: [{ title: "Batch manufactured", place: "Viatris · Dublin, IE", time: hoursAgo(96), actor: "Manufacturer", hash: "0x3e12...a580" }, { title: "Quality review requested", place: "Munich Quality Lab", time: hoursAgo(7), actor: "Regulator", hash: "0x95c1...6240" }] }
    ],
    recalls: [
      { id: "RC-2025-014", product: "Insulin Glargine 100 IU", batch: "MED-2025-0841", severity: "Critical", reason: "Temperature excursion above safe storage range", status: "Active", date: hoursAgo(3) },
      { id: "RC-2025-011", product: "Lisinopril 10mg", batch: "MED-2025-0819", severity: "Moderate", reason: "Packaging integrity review", status: "Resolved", date: hoursAgo(240) }
    ],
    temperatureLogs: {
      "MED-2025-0841": [
        { time: hoursAgo(6), value: 4.2 }, { time: hoursAgo(5), value: 4.6 }, { time: hoursAgo(4), value: 4.4 }, { time: hoursAgo(3), value: 5.1 }, { time: hoursAgo(2), value: 5.4 }, { time: hoursAgo(1), value: 4.9 }, { time: hoursAgo(0.2), value: 9.4 }
      ]
    }
  };

  function read() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return structuredClone(initialData);
      const data = JSON.parse(saved);
      if (!data.temperatureLogs) {
        data.temperatureLogs = { "MED-2025-0841": data.temperatureLog || [] };
        data.batches.forEach((batch) => {
          if (!data.temperatureLogs[batch.id]) data.temperatureLogs[batch.id] = [{ time: batch.updated, value: batch.temperature }];
        });
        delete data.temperatureLog;
      }
      return data;
    } catch (error) {
      console.error("Could not read the MedLedger demo store.", error);
      return structuredClone(initialData);
    }
  }
  function write(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  const delay = () => new Promise((resolve) => setTimeout(resolve, 120));

  window.SupplyChainAPI = {
    async getDashboard() {
      await delay();
      const data = read();
      return {
        batches: data.batches,
        recalls: data.recalls,
        activeBatches: data.batches.filter((batch) => batch.status !== "Delivered").length,
        deliveredToday: data.batches.filter((batch) => batch.status === "Delivered").length + 126,
        alerts: data.batches.filter((batch) => batch.status === "Temperature alert").length + data.recalls.filter((recall) => recall.status === "Active").length,
        verified: 1284,
        temperatureLogs: data.temperatureLogs,
        recentEvents: data.batches.flatMap((batch) => batch.events.map((event) => ({ ...event, batchId: batch.id, product: batch.product }))).sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 5)
      };
    },
    async getBatches() { await delay(); return read().batches; },
    async getBatch(id) { await delay(); return read().batches.find((batch) => batch.id.toLowerCase() === String(id).toLowerCase()) || null; },
    async createBatch(batch) {
      await delay();
      const data = read();
      if (data.batches.some((item) => item.id.toLowerCase() === batch.id.toLowerCase())) throw new Error("A batch with this ID already exists.");
      const created = { ...batch, status: "Manufactured", updated: new Date().toISOString(), hash: `0x${crypto.randomUUID().replace(/-/g, "").slice(0, 4)}...${crypto.randomUUID().slice(-4)}`, events: [{ title: "Batch registered on demo ledger", place: batch.location, time: new Date().toISOString(), actor: "Manufacturer", hash: "Pending confirmation" }] };
      data.batches.unshift(created);
      write(data);
      return created;
    },
    async simulateTemperature(id) {
      await delay();
      const data = read();
      const batch = data.batches.find((item) => item.id === id);
      if (!batch) throw new Error("Batch not found.");
      const [minimum, maximum] = temperatureBounds(batch.range);
      batch.temperature = Number((Math.random() > 0.82 ? maximum + 0.3 + Math.random() * 2 : minimum + 0.5 + Math.random() * Math.max(0.5, maximum - minimum - 1)).toFixed(1));
      batch.updated = new Date().toISOString();
      const outOfRange = batch.temperature < minimum || batch.temperature > maximum;
      if (outOfRange && !["Temperature alert", "Recall active"].includes(batch.status)) {
        batch.statusBeforeTempAlert = batch.status;
        batch.status = "Temperature alert";
      } else if (!outOfRange && batch.status === "Temperature alert") {
        batch.status = batch.statusBeforeTempAlert || "In transit";
        delete batch.statusBeforeTempAlert;
      }
      batch.events.unshift({ title: outOfRange ? "Temperature excursion detected" : "Temperature reading recorded", place: batch.location, time: batch.updated, actor: "IoT sensor", hash: `0x${crypto.randomUUID().replace(/-/g, "").slice(0, 4)}...${crypto.randomUUID().slice(-4)}` });
      data.temperatureLogs[batch.id] = data.temperatureLogs[batch.id] || [];
      data.temperatureLogs[batch.id].push({ time: batch.updated, value: batch.temperature });
      data.temperatureLogs[batch.id] = data.temperatureLogs[batch.id].slice(-12);
      write(data);
      return batch;
    },
    async createRecall(recall) {
      await delay();
      const data = read();
      const latestRecallNumber = Math.max(14, ...data.recalls.map((item) => Number(item.id.slice(-3)) || 0));
      const created = { ...recall, id: `RC-2025-${String(latestRecallNumber + 1).padStart(3, "0")}`, status: "Active", date: new Date().toISOString() };
      data.recalls.unshift(created);
      const batch = data.batches.find((item) => item.id === recall.batch);
      if (batch) {
        batch.status = "Recall active";
        batch.events.unshift({ title: "Product recall initiated", place: batch.location, time: created.date, actor: "Regulator", hash: `0x${crypto.randomUUID().replace(/-/g, "").slice(0, 4)}...${crypto.randomUUID().slice(-4)}` });
      }
      write(data);
      return created;
    },
    async resolveRecall(id) {
      await delay();
      const data = read();
      const recall = data.recalls.find((item) => item.id === id);
      if (!recall) throw new Error("Recall not found.");
      recall.status = "Resolved";
      write(data);
      return recall;
    },
    async resetDemo() {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    }
  };
})();
