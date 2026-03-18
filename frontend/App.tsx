import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import TrainsPage from "./pages/TrainsPage";
import StationsPage from "./pages/StationsPage";
import DisruptionsPage from "./pages/DisruptionsPage";
import ForecastsPage from "./pages/ForecastsPage";
import RakeTransfersPage from "./pages/RakeTransfersPage";
import SentimentPage from "./pages/SentimentPage";

export default function App() {
  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-100">
      <BrowserRouter>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-zinc-950">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trains" element={<TrainsPage />} />
              <Route path="/stations" element={<StationsPage />} />
              <Route path="/disruptions" element={<DisruptionsPage />} />
              <Route path="/forecasts" element={<ForecastsPage />} />
              <Route path="/rake-transfers" element={<RakeTransfersPage />} />
              <Route path="/sentiment" element={<SentimentPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}
