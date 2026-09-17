import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider } from "./hooks/AuthContext";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute, PublicRoute } from "./components/Guards";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Callback } from "./pages/Callback";
import { Dashboard } from "./pages/Dashboard";
import { ProfileForm } from "./pages/ProfileForm";
import { WorkerProfile } from "./pages/WorkerProfile";
import { Missions } from "./pages/Missions";
import { Candidates } from "./pages/Candidates";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route element={<PublicRoute />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Login register />} />
            </Route>
            <Route path="auth/callback" element={<Callback />} />

            <Route element={<ProtectedRoute role="worker" />}>
              <Route path="worker">
                <Route index element={<Dashboard />} />
                <Route path="profile" element={<WorkerProfile />} />
                <Route path="missions" element={<Missions />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute role="company" />}>
              <Route path="company">
                <Route index element={<Dashboard />} />
                <Route path="profile" element={<ProfileForm />} />
                <Route path="missions" element={<Missions />} />
                <Route path="candidates" element={<Candidates />} />
              </Route>
            </Route>

            <Route
              path="connexion"
              element={<Navigate to="/login" replace />}
            />
            <Route
              path="interimaire"
              element={<Navigate to="/worker" replace />}
            />
            <Route
              path="entreprise"
              element={<Navigate to="/company" replace />}
            />
            <Route
              path="*"
              element={
                <section className="login">
                  <h1>Page introuvable</h1>
                  <Link to="/">Revenir à l’accueil</Link>
                </section>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
