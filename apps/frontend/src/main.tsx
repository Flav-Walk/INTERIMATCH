import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider } from "./hooks/AuthContext";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute, PublicRoute } from "./components/Guards";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Callback } from "./pages/Callback";
import { RoleSelection } from "./pages/RoleSelection";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
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
            <Route element={<ProtectedRoute onboarding />}>
              <Route path="onboarding/role" element={<RoleSelection />} />
            </Route>
            {(["worker", "company"] as const).map((role) => (
              <React.Fragment key={role}>
                <Route element={<ProtectedRoute role={role} onboarding />}>
                  <Route
                    path={"onboarding/" + role}
                    element={<Onboarding role={role} />}
                  />
                </Route>
                <Route element={<ProtectedRoute role={role} />}>
                  <Route path={role} element={<Dashboard />} />
                  <Route
                    path={role + "/profile"}
                    element={<Dashboard profilePage />}
                  />
                </Route>
              </React.Fragment>
            ))}
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
