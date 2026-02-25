-- Make audio_url nullable to allow songs without audio files
ALTER TABLE public.songs ALTER COLUMN audio_url DROP NOT NULL;

-- Add released_date column for imported songs
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS released_date DATE;

-- Add album_type column
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS album_type TEXT;