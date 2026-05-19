import { useEffect, useMemo, useState } from "react";

const ADMIN_PASSWORD = "saffair";
const STORAGE_KEY = "borrow-system-local-cache-v2";
const GOOGLE_SHEET_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzzqEOAUKispeg_spLlO6XESD3k_L-6qcs_zsh1mVvzDKG9VaHLXEYsNaIGsnLC7XQ/exec";

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const DEPARTMENTS = [
  "ฝ่ายวิชาการ",
  "ฝ่ายกิจการนักศึกษา",
  "ฝ่ายวิจัยและวิเทศน์สัมพันธ์",
  "ฝ่ายบริการวิชาการ",
  "ฝ่ายบริการทางการแพทย์",
  "ฝ่ายบริหารทั่วไป",
  "ฝ่ายทรัพยากรบุคคล",
  "ฝ่ายยุทธศาสตร์และแผน",
  "ฝ่ายเทคโนโลยีสารสนเทศและวิทยบริการ",
  "สาขาสาธารณสุขศาสตร์",
  "สาขาทันตสาธารณสุข",
  "สาขาการแพทย์แผนไทย",
  "สาขาเทคนิคเภสัชกรรม",
  "สาขาปฏิบัติการฉุกเฉินการแพทย์",
  "สาขาฉุกเฉินการแพทย์",
  "คณะเภสัชศาสตร์",
];

const STATUS = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  returned: "คืนแล้ว",
  rejected: "ปฏิเสธ",
  overdue: "เกินกำหนด",
};

function createForm() {
  return {
    prefix: "นางสาว",
    fullname: "",
    email: "",
    phone: "",
    department: "ฝ่ายกิจการนักศึกษา",
    year: "-",
    purpose: "",
    borrowDate: today,
    dueDate: tomorrow,
    items: [{ name: "", qty: 1, note: "", photo: "", photoUrl: "" }],
    agree: false,
  };
}

function makeBorrowCode() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const time = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 900 + 100);
  return `BR-${date}-${time}${random}`;
}

function getDisplayStatus(request) {
  if (request.status === STATUS.approved && request.dueDate < today) return STATUS.overdue;
  return request.status;
}

function safeJsonParse(value, fallback) {
  try {
    if (!value) return fallback;
    if (Array.isArray(value) || typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function getPhotoSrc(item) {
  const url = item?.photo || item?.photoUrl || "";

  if (!url) return "";

  const text = String(url);

  // รูปที่ยังไม่ได้ส่งขึ้น Google Drive
  if (text.startsWith("data:image")) {
    return text;
  }

  // ถ้าเป็นลิงก์ thumbnail อยู่แล้ว
  if (text.includes("drive.google.com/thumbnail")) {
    return text;
  }

  // กรณีเป็นลิงก์ /d/FILE_ID/
  const fileIdFromView = text.match(/\/d\/([^/]+)/);

  if (fileIdFromView?.[1]) {
    return `https://drive.google.com/thumbnail?id=${fileIdFromView[1]}&sz=w1000`;
  }

  // กรณีเป็น ?id=FILE_ID
  const fileIdFromQuery = text.match(/[?&]id=([^&]+)/);

  if (fileIdFromQuery?.[1]) {
    return `https://drive.google.com/thumbnail?id=${fileIdFromQuery[1]}&sz=w1000`;
  }

  return text;
}

function normalizeRequest(raw) {
  const items = safeJsonParse(raw.items, []);
  const returnChecklist = safeJsonParse(raw.returnChecklist, []);

  return {
    id: Number(raw.id) || Date.now() + Math.random(),
    code: raw.code || "",
    prefix: raw.prefix || "",
    fullname: raw.fullname || "",
    email: raw.email || "",
    phone: raw.phone || "",
    department: raw.department || "",
    year: raw.year || "-",
    purpose: raw.purpose || "",
    borrowDate: raw.borrowDate || today,
    dueDate: raw.dueDate || today,
    status: raw.status || STATUS.pending,
    items: items.map((item) => ({
      name: item.name || "",
      qty: item.qty || 1,
      note: item.note || "",
      photo: item.photo || item.photoUrl || "",
      photoUrl: item.photoUrl || item.photo || "",
    })),
    createdAt: raw.createdAt || "",
    approvedAt: raw.approvedAt || "",
    approvedBy: raw.approvedBy || "",
    returnedAt: raw.returnedAt || "",
    returnedBy: raw.returnedBy || "",
    returnCondition: raw.returnCondition || "",
    returnChecklist,
    adminNote: raw.adminNote || "",
  };
}

function prepareSheetData(request) {
  return {
    id: request.id,
    code: request.code,
    prefix: request.prefix,
    fullname: request.fullname,
    email: request.email,
    phone: request.phone,
    department: request.department,
    year: request.year,
    purpose: request.purpose,
    borrowDate: request.borrowDate,
    dueDate: request.dueDate,
    status: request.status,
    items: request.items || [],
    createdAt: request.createdAt || "",
    approvedAt: request.approvedAt || "",
    approvedBy: request.approvedBy || "",
    returnedAt: request.returnedAt || "",
    returnedBy: request.returnedBy || "",
    returnCondition: request.returnCondition || "",
    returnChecklist: request.returnChecklist || [],
    adminNote: request.adminNote || "",
  };
}

async function saveToGoogleSheet(request) {
  const body = new URLSearchParams();

  body.append(
    "data",
    JSON.stringify(prepareSheetData(request))
  );

  try {
    await fetch(GOOGLE_SHEET_WEB_APP_URL, {
      method: "POST",
      mode: "no-cors",
      body,
    });

    console.log("saved to google sheet");
  } catch (error) {
    console.log("save error", error);
  }
}

function loadFromGoogleSheet() {
  return new Promise((resolve, reject) => {
    const callbackName = `sheetCallback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement("script");

    window[callbackName] = (data) => {
      delete window[callbackName];
      script.remove();
      resolve(data);
    };

    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error("โหลดข้อมูลจาก Google Sheet ไม่สำเร็จ"));
    };

    script.src = `${GOOGLE_SHEET_WEB_APP_URL}?action=list&callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

export default function App() {
  const [page, setPage] = useState("borrow");
  const [form, setForm] = useState(createForm());
  const [requests, setRequests] = useState([]);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");
  const [emailSearch, setEmailSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approveName, setApproveName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnChecklist, setReturnChecklist] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRequests(JSON.parse(saved));
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }, [requests]);

  async function refreshFromSheet() {
    setLoadingSheet(true);
    try {
      const data = await loadFromGoogleSheet();
      const rows = Array.isArray(data) ? data : [];
      const normalized = rows.map(normalizeRequest).filter((item) => item.code);
      setRequests(normalized.reverse());
    } catch (error) {
      console.log(error);
      alert("โหลดข้อมูลจาก Sheet ไม่สำเร็จ กรุณาตรวจสอบ Apps Script และ Deploy ใหม่");
    } finally {
      setLoadingSheet(false);
    }
  }

  const displayRequests = useMemo(() => {
    return requests.map((request) => ({ ...request, displayStatus: getDisplayStatus(request) }));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return displayRequests.filter((request) => {
      const itemText = request.items.map((item) => item.name).join(" ");
      const text = `${request.code} ${request.fullname} ${request.email} ${request.phone} ${request.department} ${request.purpose} ${itemText}`.toLowerCase();
      const okSearch = text.includes(search.toLowerCase());
      const okStatus = statusFilter === "ทั้งหมด" || request.displayStatus === statusFilter;
      return okSearch && okStatus;
    });
  }, [displayRequests, search, statusFilter]);

  const myRequests = displayRequests.filter(
    (request) => emailSearch && request.email.toLowerCase().includes(emailSearch.toLowerCase())
  );

  const stats = useMemo(() => {
    return {
      total: displayRequests.length,
      pending: displayRequests.filter((r) => r.displayStatus === STATUS.pending).length,
      approved: displayRequests.filter((r) => r.displayStatus === STATUS.approved).length,
      overdue: displayRequests.filter((r) => r.displayStatus === STATUS.overdue).length,
      returned: displayRequests.filter((r) => r.displayStatus === STATUS.returned).length,
      rejected: displayRequests.filter((r) => r.displayStatus === STATUS.rejected).length,
    };
  }, [displayRequests]);

  function updateForm(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  function updateItem(index, key, value) {
    const items = [...form.items];
    items[index] = { ...items[index], [key]: value };
    setForm({ ...form, items });
  }

  function addItem() {
    setForm({ ...form, items: [...form.items, { name: "", qty: 1, note: "", photo: "", photoUrl: "" }] });
  }

  function removeItem(index) {
    setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
  }

  function handleItemPhoto(index, event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const items = [...form.items];
      items[index] = { ...items[index], photo: reader.result, photoUrl: "" };
      setForm({ ...form, items });
    };
    reader.readAsDataURL(file);
  }

  async function submitRequest(event) {
    event.preventDefault();

    if (!form.fullname.trim()) return alert("กรุณากรอกชื่อ-นามสกุล");
    if (!form.email.trim()) return alert("กรุณากรอกอีเมล");
    if (!form.purpose.trim()) return alert("กรุณากรอกวัตถุประสงค์การยืม");
    if (form.borrowDate > form.dueDate) return alert("วันที่คืนต้องไม่น้อยกว่าวันที่ยืม");
    if (form.items.some((item) => !item.name.trim())) return alert("กรุณากรอกรายการของที่ยืมให้ครบ");
    if (form.items.some((item) => Number(item.qty) < 1)) return alert("จำนวนต้องมากกว่า 0");
    if (!form.agree) return alert("กรุณายืนยันเงื่อนไขการยืม");

    const newRequest = {
      id: Date.now(),
      code: makeBorrowCode(),
      ...form,
      items: form.items.map((item) => ({ ...item, qty: Number(item.qty) })),
      status: STATUS.pending,
      createdAt: new Date().toLocaleString("th-TH"),
      approvedAt: "",
      approvedBy: "",
      returnedAt: "",
      returnedBy: "",
      returnCondition: "",
      adminNote: "",
      returnChecklist: [],
    };

    setRequests((old) => [newRequest, ...old]);
    await saveToGoogleSheet(newRequest);
    setEmailSearch(form.email);
    setForm(createForm());
    alert(`ส่งคำขอยืมเรียบร้อยแล้ว
เลขที่คำขอ: ${newRequest.code}`);
  }

  async function loginAdmin(event) {
    event.preventDefault();
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setAdminPassword("");
      await refreshFromSheet();
    } else {
      alert("รหัสผู้ดูแลไม่ถูกต้อง");
    }
  }

  function openApproveModal(request) {
    setApproveTarget(request);
    setApproveName(adminName || "");
  }

  async function confirmApprove() {
    if (!approveTarget) return;
    if (!approveName.trim()) return alert("กรุณากรอกชื่อผู้อนุมัติ");

    setAdminName(approveName);

    const approvedRequest = {
      ...approveTarget,
      status: STATUS.approved,
      approvedAt: new Date().toLocaleString("th-TH"),
      approvedBy: approveName,
    };

    setRequests((old) => old.map((request) => (request.code === approvedRequest.code ? approvedRequest : request)));
    await saveToGoogleSheet(approvedRequest);
    await refreshFromSheet();
    setApproveTarget(null);
    setApproveName("");
  }

  async function rejectRequest(request) {
    const note = prompt("เหตุผลที่ปฏิเสธ", "") || "";
    const rejectedRequest = { ...request, status: STATUS.rejected, adminNote: note };
    setRequests((old) => old.map((item) => (item.code === rejectedRequest.code ? rejectedRequest : item)));
    await saveToGoogleSheet(rejectedRequest);
    await refreshFromSheet();
  }

  function openReturnModal(request) {
    setReturnTarget(request);
    setReturnChecklist(
      request.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        note: item.note || "",
        returned: false,
        condition: "ปกติ",
        returnNote: "",
      }))
    );
  }

  function updateReturnChecklist(index, key, value) {
    const list = [...returnChecklist];
    list[index] = { ...list[index], [key]: value };
    setReturnChecklist(list);
  }

  async function saveReturn() {
    if (!returnTarget) return;
    if (!adminName.trim()) return alert("กรุณากรอกชื่อผู้รับคืน");
    if (returnChecklist.some((item) => !item.returned)) return alert("กรุณาติ๊กคืนครบทุกชิ้นก่อนบันทึกคืน");

    const returnedRequest = {
      ...returnTarget,
      status: STATUS.returned,
      returnedAt: new Date().toLocaleString("th-TH"),
      returnedBy: adminName,
      returnCondition: returnChecklist
        .map((item) => `${item.name}: ${item.condition}${item.returnNote ? ` (${item.returnNote})` : ""}`)
        .join(" | "),
      returnChecklist,
    };

    setRequests((old) => old.map((request) => (request.code === returnedRequest.code ? returnedRequest : request)));
    await saveToGoogleSheet(returnedRequest);
    await refreshFromSheet();
    setReturnTarget(null);
    setReturnChecklist([]);
  }

  function deleteRequest(id) {
    if (!confirm("ต้องการลบรายการนี้ใช่ไหม")) return;
    setRequests((old) => old.filter((request) => request.id !== id));
  }

  function clearData() {
    setRequests([]);
    setShowClearConfirm(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <header className="hero">
          <div>
            <div className="pill">ฝ่ายกิจการนักศึกษา</div>
            <h1>ระบบยืมคืนวัสดุสิ่งของ/ครุภัณฑ์</h1>
          </div>
          <div className="nav">
            <button type="button" className={page === "borrow" ? "active" : ""} onClick={() => setPage("borrow")}>แบบฟอร์มยืม</button>
            <button type="button" className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")}>ผู้ดูแล</button>
          </div>
        </header>

        {page === "borrow" && (
          <main className="borrowGrid">
            <section className="card">
              <h2>แบบฟอร์มยืมของ</h2>
              <form onSubmit={submitRequest} className="form">
                <Step number="1" title="ข้อมูลผู้ยืม" />
                <div className="grid3">
                  <Field label="คำนำหน้า">
                    <select value={form.prefix} onChange={(e) => updateForm("prefix", e.target.value)}>
                      <option>นางสาว</option>
                      <option>นาย</option>
                      <option>นาง</option>
                    </select>
                  </Field>
                  <Field label="ชื่อ-นามสกุล">
                    <input value={form.fullname} onChange={(e) => updateForm("fullname", e.target.value)} required />
                  </Field>
                  <Field label="อีเมล">
                    <input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} required />
                  </Field>
                </div>

                <div className="grid3">
                  <Field label="เบอร์โทร">
                    <input value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} placeholder="08x-xxx-xxxx" />
                  </Field>
                  <Field label="สาขา/ฝ่าย">
                    <select value={form.department} onChange={(e) => updateForm("department", e.target.value)}>
                      {DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}
                    </select>
                  </Field>
                  <Field label="ชั้นปี">
                    <select value={form.year} onChange={(e) => updateForm("year", e.target.value)}>
                      <option>-</option>
                      <option>1</option>
                      <option>2</option>
                      <option>3</option>
                      <option>4</option>
                      <option>5</option>
                      <option>6</option>
                    </select>
                  </Field>
                </div>

                <Step number="2" title="รายละเอียดการยืม" />
                <Field label="ยืมไปใช้ในงานอะไร">
                  <input value={form.purpose} onChange={(e) => updateForm("purpose", e.target.value)} placeholder="เช่น งานการแสดง / กิจกรรม / อบรม" required />
                </Field>
                <div className="grid2">
                  <Field label="วันที่ยืม"><input type="date" value={form.borrowDate} onChange={(e) => updateForm("borrowDate", e.target.value)} required /></Field>
                  <Field label="วันที่ตั้งใจคืน"><input type="date" value={form.dueDate} onChange={(e) => updateForm("dueDate", e.target.value)} required /></Field>
                </div>

                <Step number="3" title="รายการของที่ยืม ช่องละรายการ" />
                <div className="itemList">
                  {form.items.map((item, index) => (
                    <div className="itemBox" key={index}>
                      <Field label={`รายการที่ ${index + 1}`}><input value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} placeholder="เช่น โต๊ะ / เก้าอี้ / ไมโครโฟน" required /></Field>
                      <Field label="จำนวน"><input type="number" min="1" value={item.qty} onChange={(e) => updateItem(index, "qty", e.target.value)} required /></Field>
                      <Field label="หมายเหตุ"><input value={item.note} onChange={(e) => updateItem(index, "note", e.target.value)} placeholder="เช่น สีดำ / ขนาดใหญ่" /></Field>
                      {form.items.length > 1 && <button type="button" className="btn danger light" onClick={() => removeItem(index)}>ลบ</button>}
                    </div>
                  ))}
                  <button type="button" className="addItem" onClick={addItem}>+ เพิ่มรายการ</button>
                </div>

                <Step number="4" title="รูปหลักฐานแต่ละรายการ" />
                <div className="itemPhotoList">
                  {form.items.map((item, index) => (
                    <div className="photoCard" key={index}>
                      <b>📦 รายการ {index + 1}: {item.name || "ยังไม่ได้กรอกรายการ"}</b>
                      <label className="uploadBox smallUpload">
                        <span>📷 แนบรูปของรายการนี้</span>
                        <small>ถ่ายรูปหรือแนบรูปเฉพาะรายการ</small>
                        <input type="file" accept="image/*" onChange={(e) => handleItemPhoto(index, e)} hidden />
                        {getPhotoSrc(item) && <img src={getPhotoSrc(item)} alt="preview" />}
                      </label>
                    </div>
                  ))}
                </div>

                <label className="agree">
                  <input type="checkbox" checked={form.agree} onChange={(e) => updateForm("agree", e.target.checked)} />
                  <span>ข้าพเจ้ายืนยันว่าจะดูแลรักษาวัสดุ/ครุภัณฑ์ และคืนตามกำหนด หากชำรุดหรือสูญหายจะแจ้งเจ้าหน้าที่ทันที</span>
                </label>

                <button className="submitBtn">ส่งคำขอยืม</button>
              </form>
            </section>

            <aside className="rightCol">
              <section className="card">
                <h2>สถานะการยืมของฉัน</h2>
                <input className="searchInput" placeholder="กรอกอีเมลเพื่อดูสถานะ" value={emailSearch} onChange={(e) => setEmailSearch(e.target.value)} />
                <div className="statusList">
                  {myRequests.length === 0 && <p className="empty">กรอกอีเมลเพื่อดูสถานะ</p>}
                  {myRequests.map((request) => (
                    <button type="button" key={request.id} className="miniCard" onClick={() => setSelected(request)}>
                      <div className="rowBetween"><b>{request.code}</b><Badge status={request.displayStatus} /></div>
                      {request.items.map((item, index) => <p key={index}>• {item.name} จำนวน {item.qty}</p>)}
                      <small>ยืม {request.borrowDate} • คืน {request.dueDate}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="card help">
                <h2>คำแนะนำ</h2>
                <p>1. กรอกข้อมูลผู้ยืมให้ครบ</p>
                <p>2. เพิ่มรายการของที่ยืมแยกทีละช่อง</p>
                <p>3. แนบรูปหลักฐาน หากมี</p>
                <p>4. ตรวจสถานะด้วยอีเมล</p>
              </section>
            </aside>
          </main>
        )}

        {page === "admin" && !isAdmin && (
          <section className="card loginCard">
            <h2>เข้าสู่ระบบผู้ดูแล</h2>
            <form className="form" onSubmit={loginAdmin}>
              <Field label="รหัสผู้ดูแล"><input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="กรอกรหัสผู้ดูแล" required /></Field>
              <button className="submitBtn">เข้าสู่ระบบ</button>
            </form>
          </section>
        )}

        {page === "admin" && isAdmin && (
          <main className="adminPage">
            <div className="adminToolbar">
              <div>
                <button type="button" className="btn success" onClick={refreshFromSheet}>{loadingSheet ? "กำลังโหลด..." : "รีเฟรชข้อมูลจาก Sheet"}</button>
                <button type="button" className="btn primary" onClick={() => setShowReport(true)}>เปิดรายงานในระบบ</button>
                <button type="button" className="btn danger" onClick={() => setShowClearConfirm(true)}>ล้างข้อมูลในเครื่อง</button>
              </div>
              <button type="button" className="btn" onClick={() => setIsAdmin(false)}>ออกจากระบบ</button>
            </div>

            <section className="statGrid">
              <Stat label="ทั้งหมด" value={stats.total} />
              <Stat label="รออนุมัติ" value={stats.pending} />
              <Stat label="อนุมัติแล้ว" value={stats.approved} />
              <Stat label="เกินกำหนด" value={stats.overdue} />
              <Stat label="คืนแล้ว" value={stats.returned} />
              <Stat label="ปฏิเสธ" value={stats.rejected} />
            </section>

            <section className="card">
              <h2>จัดการคำขอยืม</h2>
              <div className="filterBar">
                <input placeholder="ค้นหาชื่อ / อีเมล / เบอร์ / รายการ" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {["ทั้งหมด", STATUS.pending, STATUS.approved, STATUS.overdue, STATUS.returned, STATUS.rejected].map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>

              <div className="requestList">
                {filteredRequests.length === 0 && <p className="empty">ไม่มีรายการ กดรีเฟรชข้อมูลจาก Sheet</p>}
                {filteredRequests.map((request) => (
                  <RequestCard key={request.id} request={request} onView={() => setSelected(request)} onApprove={() => openApproveModal(request)} onReject={() => rejectRequest(request)} onReturn={() => openReturnModal(request)} onDelete={() => deleteRequest(request.id)} />
                ))}
              </div>
            </section>
          </main>
        )}

        {selected && <DetailModal request={selected} onClose={() => setSelected(null)} />}
        {approveTarget && (
          <div className="modalBackdrop">
            <div className="modal smallModal">
              <div className="modalHeader"><h2>อนุมัติคำขอ {approveTarget.code}</h2><button type="button" onClick={() => setApproveTarget(null)}>×</button></div>
              <p><b>ผู้ยืม:</b> {approveTarget.prefix}{approveTarget.fullname}</p>
              <Field label="ชื่อผู้อนุมัติ"><input value={approveName} onChange={(e) => setApproveName(e.target.value)} placeholder="กรอกชื่อผู้อนุมัติ" /></Field>
              <div className="actionRow"><button type="button" className="btn success" onClick={confirmApprove}>ยืนยันอนุมัติ</button><button type="button" className="btn" onClick={() => setApproveTarget(null)}>ยกเลิก</button></div>
            </div>
          </div>
        )}

        {returnTarget && (
          <div className="modalBackdrop">
            <div className="modal smallModal">
              <div className="modalHeader"><h2>บันทึกคืน {returnTarget.code}</h2><button type="button" onClick={() => setReturnTarget(null)}>×</button></div>
              <p><b>ผู้ยืม:</b> {returnTarget.prefix}{returnTarget.fullname}</p>
              <p><b>เช็กลิสต์รายการคืน:</b></p>
              <div className="returnChecklist">
                {returnChecklist.map((item, index) => (
                  <div className="returnCheckItem" key={index}>
                    <label className="checkLine"><input type="checkbox" checked={item.returned} onChange={(e) => updateReturnChecklist(index, "returned", e.target.checked)} /><b>{index + 1}. {item.name}</b><span>จำนวน {item.qty}</span></label>
                    {item.note && <p className="muted">หมายเหตุเดิม: {item.note}</p>}
                    <div className="grid2 returnGrid">
                      <Field label="สภาพตอนคืน"><select value={item.condition} onChange={(e) => updateReturnChecklist(index, "condition", e.target.value)}><option>ปกติ</option><option>ชำรุดเล็กน้อย</option><option>ชำรุดหนัก</option><option>สูญหาย</option></select></Field>
                      <Field label="หมายเหตุการคืน"><input value={item.returnNote} onChange={(e) => updateReturnChecklist(index, "returnNote", e.target.value)} placeholder="เช่น ครบ / มีรอย / ขาดอุปกรณ์" /></Field>
                    </div>
                  </div>
                ))}
              </div>
              <Field label="ชื่อผู้รับคืน"><input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="กรอกชื่อผู้รับคืน" /></Field>
              <div className="actionRow"><button type="button" className="btn primary" onClick={saveReturn}>ยืนยันบันทึกคืน</button><button type="button" className="btn" onClick={() => setReturnTarget(null)}>ยกเลิก</button></div>
            </div>
          </div>
        )}

        {showReport && <ReportModal requests={displayRequests} onClose={() => setShowReport(false)} />}

        {showClearConfirm && (
          <div className="modalBackdrop"><div className="modal smallModal"><div className="modalHeader"><h2>ยืนยันการล้างข้อมูลในเครื่อง</h2><button type="button" onClick={() => setShowClearConfirm(false)}>×</button></div><p>การล้างนี้ลบเฉพาะข้อมูลในเครื่อง ไม่ลบข้อมูลใน Google Sheet</p><div className="actionRow"><button type="button" className="btn danger" onClick={clearData}>ล้างข้อมูลในเครื่อง</button><button type="button" className="btn" onClick={() => setShowClearConfirm(false)}>ยกเลิก</button></div></div></div>
        )}
      </div>
    </>
  );
}

function Step({ number, title }) {
  return <div className="step"><span>{number}</span><b>{title}</b></div>;
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Badge({ status }) {
  const className = status === STATUS.pending ? "pending" : status === STATUS.approved ? "approved" : status === STATUS.returned ? "returned" : status === STATUS.rejected ? "rejected" : "overdue";
  return <span className={`badge ${className}`}>{status}</span>;
}

function Stat({ label, value }) {
  return <div className="stat"><b>{value}</b><span>{label}</span></div>;
}

function RequestCard({ request, onView, onApprove, onReject, onReturn, onDelete }) {
  return (
    <div className="requestCard">
      <div className="requestHeader">
        <div><div className="rowStart"><b className="code">{request.code}</b><Badge status={request.displayStatus} /></div><h3>{request.prefix}{request.fullname}</h3><p>{request.email} {request.phone ? `• ${request.phone}` : ""} • {request.department} • ชั้นปี {request.year}</p></div>
        {request.items.some((item) => getPhotoSrc(item)) && <div className="photoPreviewGroup">{request.items.map((item, index) => getPhotoSrc(item) ? <img key={index} src={getPhotoSrc(item)} alt={item.name} /> : null)}</div>}
      </div>
      <div className="borrowItems">{request.items.map((item, index) => <div key={index}>• <b>{item.name}</b> จำนวน <b>{item.qty}</b>{item.note ? <span> ({item.note})</span> : null}</div>)}</div>
      <p className="muted">งาน: {request.purpose} • ยืม {request.borrowDate} • กำหนดคืน {request.dueDate}</p>
      {request.approvedBy && <p className="blue">ผู้อนุมัติ: {request.approvedBy}</p>}
      {request.returnedAt && <p className="blue">คืนแล้ว: {request.returnedAt} • ผู้รับคืน: {request.returnedBy}</p>}
      {request.returnChecklist && request.returnChecklist.length > 0 && <div className="returnSummary">{request.returnChecklist.map((item, index) => <div key={index}>✓ {item.name} จำนวน {item.qty} • {item.condition}{item.returnNote ? ` (${item.returnNote})` : ""}</div>)}</div>}
      {request.adminNote && <p className="red">หมายเหตุ: {request.adminNote}</p>}
      <div className="actionRow"><button type="button" className="btn" onClick={onView}>ดูรายละเอียด</button>{request.displayStatus === STATUS.pending && <button type="button" className="btn success" onClick={onApprove}>อนุมัติ</button>}{request.displayStatus === STATUS.pending && <button type="button" className="btn danger" onClick={onReject}>ปฏิเสธ</button>}{(request.displayStatus === STATUS.approved || request.displayStatus === STATUS.overdue) && <button type="button" className="btn primary" onClick={onReturn}>บันทึกคืน</button>}<button type="button" className="btn danger light" onClick={onDelete}>ลบในเครื่อง</button></div>
    </div>
  );
}

function DetailModal({ request, onClose }) {
  return (
    <div className="modalBackdrop"><div className="modal"><div className="modalHeader"><h2>รายละเอียดคำขอ {request.code}</h2><button type="button" onClick={onClose}>×</button></div><Badge status={request.displayStatus} /><div className="detailGrid"><p><b>ผู้ยืม:</b> {request.prefix}{request.fullname}</p><p><b>อีเมล:</b> {request.email}</p><p><b>เบอร์โทร:</b> {request.phone || "-"}</p><p><b>สาขา/ฝ่าย:</b> {request.department}</p><p><b>ชั้นปี:</b> {request.year}</p><p><b>วัตถุประสงค์:</b> {request.purpose}</p><p><b>วันที่ยืม:</b> {request.borrowDate}</p><p><b>กำหนดคืน:</b> {request.dueDate}</p><p><b>ผู้อนุมัติ:</b> {request.approvedBy || "-"}</p><p><b>ผู้รับคืน:</b> {request.returnedBy || "-"}</p><p><b>วันที่คืน:</b> {request.returnedAt || "-"}</p></div><h3>รายการของที่ยืม</h3>{request.items.map((item, index) => <div className="modalItem" key={index}>{index + 1}. {item.name} จำนวน {item.qty} {item.note ? `(${item.note})` : ""}</div>)}{request.returnChecklist && request.returnChecklist.length > 0 && <><h3>เช็กลิสต์การคืน</h3>{request.returnChecklist.map((item, index) => <div className="modalItem" key={index}>✓ {index + 1}. {item.name} จำนวน {item.qty} • {item.condition}{item.returnNote ? ` (${item.returnNote})` : ""}</div>)}</>}{request.items.some((item) => getPhotoSrc(item)) && <><h3>รูปหลักฐานแต่ละรายการ</h3><div className="detailPhotos">{request.items.map((item, index) => getPhotoSrc(item) ? <div key={index} className="detailPhotoCard"><p><b>{item.name}</b></p><img className="modalPhoto" src={getPhotoSrc(item)} alt={item.name} /></div> : null)}</div></>}</div></div>
  );
}

function ReportModal({ requests, onClose }) {
  return (
    <div className="modalBackdrop"><div className="modal reportModal"><div className="modalHeader"><h2>รายงานการยืมคืนวัสดุสิ่งของ/ครุภัณฑ์</h2><button type="button" onClick={onClose}>×</button></div><div className="reportActions"><button type="button" className="btn" onClick={onClose}>ปิด</button></div><div className="reportBox"><table className="reportTable"><thead><tr><th>เลขที่</th><th>ผู้ยืม</th><th>สาขา/ฝ่าย</th><th>วันที่ยืม</th><th>กำหนดคืน</th><th>สถานะ</th><th>ผู้อนุมัติ</th><th>ผู้รับคืน</th><th>รายการ</th></tr></thead><tbody>{requests.length === 0 && <tr><td colSpan={9} className="emptyCell">ไม่มีข้อมูล</td></tr>}{requests.map((request) => <tr key={request.code}><td>{request.code}</td><td>{request.prefix}{request.fullname}</td><td>{request.department}</td><td>{request.borrowDate}</td><td>{request.dueDate}</td><td>{request.displayStatus}</td><td>{request.approvedBy || "-"}</td><td>{request.returnedBy || "-"}</td><td>{request.items.map((item, index) => <div key={index}>• {item.name} x {item.qty}</div>)}</td></tr>)}</tbody></table></div></div></div>
  );
}

const styles = `
*{box-sizing:border-box}body{margin:0;background:#fffdf5;color:#4b2e83;font-family:Arial,'Noto Sans Thai',sans-serif}button,input,select{font:inherit}button{cursor:pointer}.app{max-width:1220px;margin:0 auto;padding:18px}.hero{display:flex;justify-content:space-between;gap:16px;align-items:center;color:#fff;background:linear-gradient(135deg,#7c3aed,#c084fc,#facc15);border-radius:30px;padding:28px;box-shadow:0 18px 48px rgba(147,51,234,.28)}.pill{display:inline-block;background:rgba(255,255,255,.28);padding:8px 14px;border-radius:999px;font-weight:900;box-shadow:0 4px 10px rgba(255,255,255,.3)}.hero h1{font-size:34px;margin:12px 0 8px;text-shadow:0 2px 8px rgba(255,255,255,.3)}.nav{display:flex;background:rgba(255,255,255,.16);padding:6px;border-radius:18px}.nav button{border:0;border-radius:14px;background:transparent;color:#fff;padding:12px 18px;font-weight:900}.nav .active{background:#fff;color:#6d28d9}.borrowGrid{display:grid;grid-template-columns:1.25fr .75fr;gap:18px}.card{background:#ffffff;border:3px solid #facc15;border-radius:32px;padding:22px;box-shadow:0 12px 36px rgba(192,132,252,.25);position:relative}.card::after{content:'✨';position:absolute;top:12px;right:16px;font-size:18px}.card h2{margin:0 0 18px;color:#6d28d9}.form{display:flex;flex-direction:column;gap:16px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.field span{display:block;color:#6d28d9;font-weight:900;margin-bottom:6px}.field input,.field select,.searchInput,.filterBar input,.filterBar select{width:100%;border:1px solid #d8b4fe;border-radius:16px;padding:13px 14px;background:#fff;outline:none}.field input:focus,.field select:focus,.searchInput:focus,.filterBar input:focus,.filterBar select:focus{box-shadow:0 0 0 3px #f3e8ff}.step{border-top:1px solid #eee5ff;padding-top:15px;display:flex;align-items:center;gap:10px}.step:first-child{border-top:0;padding-top:0}.step span{width:38px;height:38px;border-radius:999px;background:linear-gradient(135deg,#c084fc,#facc15);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;box-shadow:0 4px 12px rgba(250,204,21,.4)}.step b{color:#6d28d9}.itemList{display:flex;flex-direction:column;gap:12px}.itemBox{display:grid;grid-template-columns:1fr 110px 1fr auto;gap:12px;align-items:end;background:#f6f0ff;border:1px solid #ddd6fe;border-radius:20px;padding:14px}.addItem{border:2px dashed #c084fc;background:#faf5ff;color:#6d28d9;border-radius:18px;padding:14px;font-weight:900}.uploadBox{display:block;text-align:center;border:3px dashed #c084fc;background:linear-gradient(180deg,#faf5ff,#fff7ed);border-radius:26px;padding:22px}.uploadBox span{display:block;color:#6d28d9;font-weight:900}.uploadBox small{display:block;color:#6b7280;margin-top:5px}.uploadBox img{margin-top:14px;max-width:100%;max-height:240px;border-radius:18px}.itemPhotoList{display:flex;flex-direction:column;gap:14px}.photoCard{background:linear-gradient(180deg,#faf5ff,#fef9c3);border:2px dashed #c084fc;border-radius:24px;padding:16px}.smallUpload{margin-top:10px;padding:16px}.photoPreviewGroup{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.photoPreviewGroup img{width:90px;height:90px;object-fit:cover;border-radius:14px;border:1px solid #ddd}.detailPhotos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.detailPhotoCard{background:#f8fafc;padding:12px;border-radius:16px}.agree{display:flex;gap:12px;background:#fffbeb;color:#92400e;border-radius:18px;padding:14px}.submitBtn{border:0;border-radius:24px;background:linear-gradient(135deg,#facc15,#fde68a);padding:18px;font-weight:1000;font-size:18px;color:#6d28d9;box-shadow:0 8px 20px rgba(250,204,21,.4);transition:.2s}.submitBtn:hover{transform:translateY(-2px) scale(1.01)}.rightCol{display:flex;flex-direction:column;gap:18px}.empty{text-align:center;color:#9ca3af;padding:28px}.statusList{margin-top:12px}.miniCard{width:100%;text-align:left;background:#fff;border:1px solid #eadcff;border-radius:18px;padding:14px;margin-bottom:10px}.rowBetween{display:flex;justify-content:space-between;gap:10px}.rowStart{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.miniCard p{margin:8px 0 0}.miniCard small,.muted{color:#6b7280}.loginCard{max-width:460px;margin:20px auto}.adminPage{display:flex;flex-direction:column;gap:16px}.adminToolbar{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.adminToolbar div{display:flex;gap:10px;flex-wrap:wrap}.btn{border:0;border-radius:18px;background:#ede9fe;color:#6d28d9;padding:10px 16px;font-weight:900;box-shadow:0 4px 12px rgba(192,132,252,.2);text-decoration:none;display:inline-flex;align-items:center;justify-content:center}.btn.success{background:#059669;color:#fff}.btn.primary{background:#2563eb;color:#fff}.btn.danger{background:#dc2626;color:#fff}.btn.light{background:#fee2e2;color:#b91c1c}.statGrid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.stat{background:linear-gradient(180deg,#fff,#fef9c3);border:3px solid #c084fc;border-radius:28px;text-align:center;padding:18px;box-shadow:0 8px 26px rgba(250,204,21,.25)}.stat b{display:block;font-size:32px;color:#6d28d9}.stat span{color:#6b7280}.filterBar{display:grid;grid-template-columns:1fr 220px;gap:10px}.requestList{margin-top:14px;border:1px solid #eee5ff;border-radius:22px;overflow:hidden}.requestCard{padding:18px;border-bottom:2px dashed #e9d5ff;background:linear-gradient(180deg,#fff,#faf5ff)}.requestCard:last-child{border-bottom:0}.requestHeader{display:flex;justify-content:space-between;gap:14px}.requestHeader h3{margin:8px 0 4px}.requestHeader p{margin:0;color:#6b7280}.code{color:#6d28d9}.badge{display:inline-block;border-radius:999px;border:1px solid;padding:5px 10px;font-size:12px;font-weight:900}.badge.pending{background:#fef3c7;color:#b45309;border-color:#fcd34d}.badge.approved{background:#fef9c3;color:#a16207;border-color:#fde047}.badge.returned{background:#dbeafe;color:#1d4ed8;border-color:#93c5fd}.badge.rejected{background:#fee2e2;color:#b91c1c;border-color:#fca5a5}.badge.overdue{background:#ffedd5;color:#c2410c;border-color:#fdba74}.borrowItems{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:12px 0}.borrowItems div,.modalItem{background:#f6f0ff;border-radius:14px;padding:10px}.blue{color:#2563eb;font-weight:800}.red{color:#dc2626;font-weight:800}.actionRow{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.modalBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:18px;z-index:99}.modal{background:#fffdfc;border:3px solid #facc15;border-radius:32px;max-width:720px;width:100%;max-height:90vh;overflow:auto;padding:22px;box-shadow:0 18px 50px rgba(192,132,252,.35)}.modalHeader{display:flex;justify-content:space-between;align-items:center;gap:12px}.modalHeader h2{color:#6d28d9;margin:0}.modalHeader button{border:0;background:#f3f4f6;border-radius:999px;width:38px;height:38px;font-size:24px}.detailGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}.modalPhoto{margin-top:14px;max-width:100%;max-height:380px;object-fit:contain;border-radius:18px}.smallModal{max-width:720px}.reportModal{max-width:1100px}.reportActions{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0;justify-content:flex-end}.reportBox{overflow:auto;border:1px solid #ddd;border-radius:14px}.reportTable{width:100%;border-collapse:collapse;background:white}.reportTable th,.reportTable td{border:1px solid #ddd;padding:8px;font-size:13px;text-align:left;vertical-align:top}.reportTable th{background:#f3e8ff;color:#5b21b6}.emptyCell{text-align:center;color:#999;padding:24px!important}.returnChecklist{display:flex;flex-direction:column;gap:12px;margin:10px 0}.returnCheckItem{background:#f6f0ff;border:1px solid #ddd6fe;border-radius:18px;padding:14px}.checkLine{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.checkLine input{width:20px;height:20px}.returnGrid{margin-top:10px}.returnSummary{background:#eff6ff;border-radius:14px;padding:10px;margin-top:8px;color:#1d4ed8;font-weight:700}
@media(max-width:900px){.hero,.adminToolbar,.requestHeader{flex-direction:column;align-items:stretch}.borrowGrid,.grid2,.grid3,.statGrid,.filterBar,.borrowItems,.detailGrid{grid-template-columns:1fr}.itemBox{grid-template-columns:1fr}.nav button{flex:1}.hero h1{font-size:26px}.app{padding:12px}}
`;
