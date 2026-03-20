import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Sidebar from "./components/Sidebar";
import GlobalLiveRailMap from "./components/GlobalLiveRailMap";
import Dashboard from "./pages/Dashboard";
import TrainsPage from "./pages/TrainsPage";
import StationsPage from "./pages/StationsPage";
import DisruptionsPage from "./pages/DisruptionsPage";
import ForecastsPage from "./pages/ForecastsPage";
import RakeTransfersPage from "./pages/RakeTransfersPage";
import SentimentPage from "./pages/SentimentPage";
import CoachReallocationPage from "./pages/CoachReallocationPage";
import CascadeDisruptionPage from "./pages/CascadeDisruptionPage";
import RakeSharingNetworkPage from "./pages/RakeSharingNetworkPage";
import AIExplainabilityPage from "./pages/AIExplainabilityPage";
import CrowdDensityPage from "./pages/CrowdDensityPage";
import PassengerTransparencyPage from "./pages/PassengerTransparencyPage";
import AlertSystemPage from "./pages/AlertSystemPage";
import SimulationPage from "./pages/SimulationPage";

export default function App() {
  return (
    <div className="dark min-h-screen bg-zinc-950 text-zinc-100">
      <BrowserRouter>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-zinc-950">
            <div className="p-4 pb-0">
              <GlobalLiveRailMap />
            </div>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/trains" element={<TrainsPage />} />
              <Route path="/stations" element={<StationsPage />} />
              <Route path="/disruptions" element={<DisruptionsPage />} />
              <Route path="/forecasts" element={<ForecastsPage />} />
              <Route path="/rake-transfers" element={<RakeTransfersPage />} />
              <Route path="/sentiment" element={<SentimentPage />} />
              <Route path="/coach-reallocation" element={<CoachReallocationPage />} />
              <Route path="/cascade-disruptions" element={<CascadeDisruptionPage />} />
              <Route path="/rake-sharing" element={<RakeSharingNetworkPage />} />
              <Route path="/ai-explainability" element={<AIExplainabilityPage />} />
              <Route path="/crowd-density" element={<CrowdDensityPage />} />
              <Route path="/passenger-transparency" element={<PassengerTransparencyPage />} />
              <Route path="/alerts" element={<AlertSystemPage />} />
              <Route path="/simulation" element={<SimulationPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}
