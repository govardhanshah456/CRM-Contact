import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ContactDetailPage } from "./pages/ContactDetailPage.tsx";
import { ContactsPage } from "./pages/ContactsPage.tsx";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/contacts">CRM Contacts</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/contacts" replace />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/:id" element={<ContactDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
