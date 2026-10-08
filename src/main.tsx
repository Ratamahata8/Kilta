import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, CatalogProvider } from "./lib/store";
import { Shell } from "./components/Shell";
import {
  HomePage,
  CatalogPage,
  ProductPage,
  WorkshopPage,
  ShowroomsPage,
  ContactsPage,
  DocumentPage,
  NotFoundPage,
} from "./pages/PublicPages";
import { lazy, Suspense } from "react";
const AdminApp = lazy(() =>
  import("./admin/AdminApp").then((module) => ({ default: module.AdminApp })),
);
import { ErrorBoundary } from "./components/ErrorBoundary";
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <HashRouter>
      <AuthProvider>
        <CatalogProvider>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<HomePage />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="products/:slug" element={<ProductPage />} />
              <Route path="workshop" element={<WorkshopPage />} />
              <Route path="showrooms" element={<ShowroomsPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="documents/:slug" element={<DocumentPage />} />
              <Route
                path="admin/*"
                element={
                  <Suspense fallback={<p>Загружаем админку…</p>}>
                    <AdminApp />
                  </Suspense>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </CatalogProvider>
      </AuthProvider>
    </HashRouter>
  </ErrorBoundary>,
);
