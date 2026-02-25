import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { MusicPlayer } from "@/components/player/MusicPlayer";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Artists from "./pages/Artists";
import ArtistProfile from "./pages/ArtistProfile";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Discover from "./pages/Discover";
import NotFound from "./pages/NotFound";
import AlbumDetails from "./pages/AlbumDetails";

const queryClient = new QueryClient();

const AuthenticatedMusicPlayer = () => {
  const { user } = useAuth();
  if (!user) return null;
  return <MusicPlayer />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <PlayerProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/home" element={<Home />} />
              <Route path="/library" element={<Library />} />
              <Route path="/artists" element={<Artists />} />
              <Route path="/artist/:id" element={<ArtistProfile />} />
              <Route path="/album/:id" element={<AlbumDetails />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <AuthenticatedMusicPlayer />
          </BrowserRouter>
        </PlayerProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
