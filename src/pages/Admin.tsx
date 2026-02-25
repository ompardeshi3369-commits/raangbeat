import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Music, Loader2, Shield, UserPlus, Info, Mail, Phone, Instagram, Save } from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { siteSettingsApi, AboutUsSettings } from "@/lib/mongodb";

type Artist = Tables<'artists'>;

const defaultAboutSettings: AboutUsSettings = {
  description: "Welcome to RangeBeat – your ultimate destination for music discovery. We're passionate about connecting people through the power of music, offering a curated experience that celebrates diverse sounds from around the world.",
  primaryEmail: "support@rangebeat.com",
  businessEmail: "business@rangebeat.com",
  phone: "+1 (234) 567-890",
  instagram: "https://instagram.com/",
  instagram2: "https://instagram.com/",
};

export default function Admin() {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Song form state
  const [songTitle, setSongTitle] = useState("");
  const [artistId, setArtistId] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [duration, setDuration] = useState("");

  // New artist form state
  const [newArtistName, setNewArtistName] = useState("");
  const [showNewArtist, setShowNewArtist] = useState(false);

  // About Us settings state
  const [aboutSettings, setAboutSettings] = useState<AboutUsSettings>(defaultAboutSettings);
  const [isSavingAbout, setIsSavingAbout] = useState(false);
  const [isLoadingAbout, setIsLoadingAbout] = useState(true);

  useEffect(() => {
    fetchArtists();
    fetchAboutSettings();
  }, []);

  const fetchAboutSettings = async () => {
    try {
      const { settings } = await siteSettingsApi.getAboutUs();
      if (settings) {
        setAboutSettings(settings);
      }
    } catch (error) {
      console.error("Error loading about settings:", error);
    } finally {
      setIsLoadingAbout(false);
    }
  };

  const handleSaveAboutSettings = async () => {
    setIsSavingAbout(true);
    try {
      await siteSettingsApi.updateAboutUs(aboutSettings);
      toast.success("About Us settings saved successfully!");
    } catch (error) {
      console.error("Error saving about settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSavingAbout(false);
    }
  };

  const fetchArtists = async () => {
    const { data, error } = await supabase
      .from('artists')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching artists:', error);
    } else {
      setArtists(data || []);
    }
  };

  const handleAddArtist = async () => {
    if (!newArtistName.trim()) {
      toast.error("Please enter an artist name");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('artists')
        .insert({ name: newArtistName.trim() })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Artist "${newArtistName}" added!`);
      setNewArtistName("");
      setShowNewArtist(false);
      setArtistId(data.id);
      await fetchArtists();
    } catch (error) {
      console.error('Error adding artist:', error);
      toast.error("Failed to add artist");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!songTitle.trim()) {
      toast.error("Please enter a song title");
      return;
    }

    if (!artistId) {
      toast.error("Please select an artist");
      return;
    }

    if (!audioUrl.trim()) {
      toast.error("Please enter an audio URL");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('songs')
        .insert({
          title: songTitle.trim(),
          artist_id: artistId,
          audio_url: audioUrl.trim(),
          cover_url: coverUrl.trim() || null,
          duration: duration ? parseInt(duration) : null,
        });

      if (error) throw error;

      toast.success(`Song "${songTitle}" added successfully!`);
      setSongTitle("");
      setAudioUrl("");
      setCoverUrl("");
      setDuration("");
    } catch (error) {
      console.error('Error adding song:', error);
      toast.error("Failed to add song. Make sure you have admin permissions.");
    } finally {
      setIsLoading(false);
    }
  };

  if (adminLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground text-center max-w-md">
            You need admin privileges to access this page. Contact the administrator to get access.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen p-6 pb-32">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold gradient-text mb-2">Admin Panel</h1>
            <p className="text-muted-foreground">
              Manage your music library and site settings
            </p>
          </div>

          <Tabs defaultValue="songs" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="songs" className="flex items-center gap-2">
                <Music className="w-4 h-4" />
                Songs
              </TabsTrigger>
              <TabsTrigger value="about" className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                About Us
              </TabsTrigger>
            </TabsList>

            {/* Songs Tab */}
            <TabsContent value="songs" className="space-y-6">
              {/* Add Song Card */}
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="w-5 h-5 text-primary" />
                    Add New Song
                  </CardTitle>
                  <CardDescription>
                    Add songs with external audio URLs (YouTube, direct MP3 links, etc.)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddSong} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Song Title *</Label>
                      <Input
                        id="title"
                        value={songTitle}
                        onChange={(e) => setSongTitle(e.target.value)}
                        placeholder="Enter song title"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Artist *</Label>
                      {!showNewArtist ? (
                        <div className="flex gap-2">
                          <Select value={artistId} onValueChange={setArtistId}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select an artist" />
                            </SelectTrigger>
                            <SelectContent>
                              {artists.map((artist) => (
                                <SelectItem key={artist.id} value={artist.id}>
                                  {artist.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setShowNewArtist(true)}
                          >
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            value={newArtistName}
                            onChange={(e) => setNewArtistName(e.target.value)}
                            placeholder="New artist name"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleAddArtist}
                            disabled={isLoading}
                          >
                            Add
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setShowNewArtist(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="audioUrl">Audio URL *</Label>
                      <Input
                        id="audioUrl"
                        value={audioUrl}
                        onChange={(e) => setAudioUrl(e.target.value)}
                        placeholder="https://example.com/song.mp3 or YouTube embed URL"
                      />
                      <p className="text-xs text-muted-foreground">
                        Direct MP3/audio file URL, or external streaming link
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="coverUrl">Cover Image URL</Label>
                      <Input
                        id="coverUrl"
                        value={coverUrl}
                        onChange={(e) => setCoverUrl(e.target.value)}
                        placeholder="https://example.com/cover.jpg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (seconds)</Label>
                      <Input
                        id="duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="180"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full"
                      size="lg"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Song
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Tips Card */}
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Tips for Adding Songs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong>Audio URLs:</strong> Use direct links to MP3 files or audio streams.
                    Some sources that work:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Direct MP3 file URLs</li>
                    <li>Cloud storage links (Google Drive, Dropbox with direct link)</li>
                    <li>Self-hosted audio files</li>
                  </ul>
                  <p className="text-warning">
                    ⚠️ Note: YouTube links require special handling and may not work directly.
                    Use direct audio file URLs for best results.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* About Us Tab */}
            <TabsContent value="about" className="space-y-6">
              <Card className="glass-card border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    About Us Settings
                  </CardTitle>
                  <CardDescription>
                    Configure the About Us section shown on user profiles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAbout ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Description */}
                      <div className="space-y-2">
                        <Label htmlFor="aboutDescription">Description</Label>
                        <Textarea
                          id="aboutDescription"
                          value={aboutSettings.description}
                          onChange={(e) => setAboutSettings(s => ({ ...s, description: e.target.value }))}
                          placeholder="Enter a description about your platform..."
                          rows={4}
                        />
                      </div>

                      {/* Emails */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="primaryEmail" className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-primary" />
                            Primary Email
                          </Label>
                          <Input
                            id="primaryEmail"
                            type="email"
                            value={aboutSettings.primaryEmail}
                            onChange={(e) => setAboutSettings(s => ({ ...s, primaryEmail: e.target.value }))}
                            placeholder="support@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="businessEmail" className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-accent" />
                            Business Email
                          </Label>
                          <Input
                            id="businessEmail"
                            type="email"
                            value={aboutSettings.businessEmail}
                            onChange={(e) => setAboutSettings(s => ({ ...s, businessEmail: e.target.value }))}
                            placeholder="business@example.com"
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-primary" />
                          Phone Number
                        </Label>
                        <Input
                          id="phone"
                          value={aboutSettings.phone}
                          onChange={(e) => setAboutSettings(s => ({ ...s, phone: e.target.value }))}
                          placeholder="+1 (234) 567-890"
                        />
                      </div>

                      {/* Social Media */}
                      <div className="space-y-4">
                        <Label className="text-base font-semibold">Social Media Links</Label>

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Instagram #1 (Creator 1)</Label>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                                <Instagram className="w-4 h-4 text-pink-400" />
                              </div>
                              <Input
                                value={aboutSettings.instagram}
                                onChange={(e) => setAboutSettings(s => ({ ...s, instagram: e.target.value }))}
                                placeholder="https://instagram.com/yourhandle"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Instagram #2 (Creator 2)</Label>
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                                <Instagram className="w-4 h-4 text-pink-400" />
                              </div>
                              <Input
                                value={aboutSettings.instagram2}
                                onChange={(e) => setAboutSettings(s => ({ ...s, instagram2: e.target.value }))}
                                placeholder="https://instagram.com/friendshandle"
                                className="flex-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveAboutSettings}
                        disabled={isSavingAbout}
                        className="w-full"
                        size="lg"
                      >
                        {isSavingAbout ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Settings
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
}
