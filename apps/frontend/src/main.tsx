import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider } from "./hooks/AuthContext";
import { CompanyDataProvider } from "./hooks/CompanyData";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute, PublicRoute } from "./components/Guards";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { MentionsLegales } from "./pages/MentionsLegales";
import { PolitiqueConfidentialite } from "./pages/PolitiqueConfidentialite";
import { Accessibilite } from "./pages/Accessibilite";
import { usePageSeo } from "./hooks/usePageSeo";
import "./styles/global.css";
// Tailwind : uniquement pour les composants copiés depuis Magic UI, Aceternity
// et SmoothUI (dossier components/ui). Il ne touche pas au reste du site.
import "./styles/tailwind.css";
// Mes réglages CSS pour les animations (cartes, champs, badges, menu…).
import "./styles/motion.css";

function NotFound() {
  usePageSeo({
    title: "Page introuvable · InteriMatch",
    description: "La page demandée est introuvable sur InteriMatch.",
    robots: "noindex,nofollow",
  });
  return (
    <section className="login">
      <h1>Page introuvable</h1>
      <Link to="/">Revenir à l’accueil</Link>
    </section>
  );
}

/**
 * Chaque espace est chargé quand on y entre.
 *
 * Tout était jusqu'ici réuni dans un seul fichier de 666 ko : un visiteur de la
 * page d'accueil téléchargeait l'espace entreprise, l'espace intérimaire et
 * l'administration avant de voir le premier mot. Les deux espaces ne se
 * croisent jamais — un compte a un rôle — et l'administration ne concerne
 * presque personne.
 */
const Callback = lazy(() =>
  import("./pages/Callback").then((m) => ({ default: m.Callback })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const ProfileForm = lazy(() =>
  import("./pages/ProfileForm").then((m) => ({ default: m.ProfileForm })),
);
const WorkerProfile = lazy(() =>
  import("./pages/WorkerProfile").then((m) => ({ default: m.WorkerProfile })),
);
const Missions = lazy(() =>
  import("./pages/Missions").then((m) => ({ default: m.Missions })),
);
const WorkerMissionDetail = lazy(() =>
  import("./pages/WorkerMissionDetail").then((m) => ({
    default: m.WorkerMissionDetail,
  })),
);
const WorkerApplications = lazy(() =>
  import("./pages/WorkerApplications").then((m) => ({
    default: m.WorkerApplications,
  })),
);
const WorkerPublicOffers = lazy(() =>
  import("./pages/WorkerPublicOffers").then((m) => ({
    default: m.WorkerPublicOffers,
  })),
);
const WorkerPublicOfferDetail = lazy(() =>
  import("./pages/WorkerPublicOfferDetail").then((m) => ({
    default: m.WorkerPublicOfferDetail,
  })),
);
const CompanyDashboard = lazy(() =>
  import("./pages/CompanyDashboard").then((m) => ({
    default: m.CompanyDashboard,
  })),
);
const CompanyMissions = lazy(() =>
  import("./pages/CompanyMissions").then((m) => ({
    default: m.CompanyMissions,
  })),
);
const CompanyMissionDetail = lazy(() =>
  import("./pages/CompanyMissionDetail").then((m) => ({
    default: m.CompanyMissionDetail,
  })),
);
const CompanyMissionForm = lazy(() =>
  import("./pages/CompanyMissionForm").then((m) => ({
    default: m.CompanyMissionForm,
  })),
);
const CompanyApplicationsPage = lazy(() =>
  import("./pages/CompanyApplications").then((m) => ({
    default: m.CompanyApplicationsPage,
  })),
);
const DocumentsPage = lazy(() =>
  import("./pages/Documents").then((m) => ({ default: m.DocumentsPage })),
);
const DocumentDetailPage = lazy(() =>
  import("./pages/DocumentDetail").then((m) => ({
    default: m.DocumentDetailPage,
  })),
);
const AdminPage = lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.AdminPage })),
);

/** Le temps d'aller chercher un espace : une ligne, pas un écran blanc. */
const Loading = () => (
  <p className="quiet route-loading" role="status">
    Chargement…
  </p>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CompanyDataProvider>
        <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route element={<PublicRoute />}>
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Login register />} />
            </Route>
            <Route path="auth/callback" element={<Callback />} />
            <Route path="mentions-legales" element={<MentionsLegales />} />
            <Route
              path="politique-confidentialite"
              element={<PolitiqueConfidentialite />}
            />
            <Route path="accessibilite" element={<Accessibilite />} />

            <Route element={<ProtectedRoute role="worker" />}>
              <Route path="worker">
                <Route index element={<Dashboard />} />
                <Route path="profile" element={<WorkerProfile />} />
                <Route path="missions" element={<Missions />} />
                <Route path="missions/:id" element={<WorkerMissionDetail />} />
                <Route path="applications" element={<WorkerApplications />} />
                <Route
                  path="documents"
                  element={<DocumentsPage role="worker" />}
                />
                <Route
                  path="documents/:id"
                  element={<DocumentDetailPage role="worker" />}
                />
                <Route path="public-offers" element={<WorkerPublicOffers />} />
                <Route
                  path="public-offers/:id"
                  element={<WorkerPublicOfferDetail />}
                />
              </Route>
            </Route>

            <Route element={<ProtectedRoute role="company" />}>
              <Route path="company">
                <Route index element={<CompanyDashboard />} />
                <Route path="profile" element={<ProfileForm />} />
                <Route path="missions" element={<CompanyMissions />} />
                <Route path="missions/new" element={<CompanyMissionForm />} />
                <Route path="missions/:id" element={<CompanyMissionDetail />} />
                <Route
                  path="missions/:id/edit"
                  element={<CompanyMissionForm />}
                />
                <Route
                  path="applications"
                  element={<CompanyApplicationsPage />}
                />
                <Route
                  path="documents"
                  element={<DocumentsPage role="company" />}
                />
                <Route
                  path="documents/:id"
                  element={<DocumentDetailPage role="company" />}
                />
                {/* Ancien libellé : les liens déjà partagés doivent survivre. */}
                <Route
                  path="candidates"
                  element={<Navigate to="/company/applications" replace />}
                />
              </Route>
            </Route>

            <Route element={<ProtectedRoute role="admin" />}>
              <Route path="admin" element={<AdminPage />} />
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
              element={<NotFound />}
            />
          </Route>
        </Routes>
        </Suspense>
        </CompanyDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
