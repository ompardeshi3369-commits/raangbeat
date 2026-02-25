import { MongoClient, ObjectId } from "npm:mongodb@6";
import { corsHeaders } from "../_shared/cors.ts";

const MONGODB_URI = Deno.env.get("MONGODB_URI")!;

interface RequestBody {
  action: string;
  songId?: string;
  artistId?: string;
  data?: Record<string, unknown>;
  query?: Record<string, unknown>;
  search?: string;
  mood?: string;
  limit?: number;
  skip?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    const body: RequestBody = await req.json();
    const { action, songId, artistId, data, query, search, mood, limit = 50, skip = 0 } = body;

    await client.connect();
    const db = client.db("rangebeat1");

    let result: unknown;

    switch (action) {
      // ============ SONGS ============
      case "get_all_songs": {
        const songs = await db.collection("songs")
          .find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        result = { songs };
        break;
      }

      case "get_song": {
        if (!songId) throw new Error("songId required");
        // Only query if it's a valid ObjectId (24 hex chars)
        if (!/^[0-9a-fA-F]{24}$/.test(songId)) {
          result = { song: null };
          break;
        }
        const song = await db.collection("songs").findOne({ 
          _id: new ObjectId(songId) 
        });
        result = { song };
        break;
      }

      case "search_songs": {
        if (!search) throw new Error("search query required");
        const songs = await db.collection("songs")
          .find({
            $or: [
              { title: { $regex: search, $options: "i" } },
              { artistName: { $regex: search, $options: "i" } },
            ]
          })
          .limit(limit)
          .toArray();
        result = { songs };
        break;
      }

      case "get_songs_by_mood": {
        if (!mood) throw new Error("mood required");
        const songs = await db.collection("songs")
          .find({ mood })
          .limit(limit)
          .toArray();
        result = { songs };
        break;
      }

      case "get_songs_by_artist": {
        if (!artistId) throw new Error("artistId required");
        const songs = await db.collection("songs")
          .find({ artistId })
          .sort({ createdAt: -1 })
          .toArray();
        result = { songs };
        break;
      }

      case "get_trending_songs": {
        const songs = await db.collection("songs")
          .find({})
          .sort({ plays: -1 })
          .limit(limit)
          .toArray();
        result = { songs };
        break;
      }

      case "get_recent_songs": {
        const songs = await db.collection("songs")
          .find({})
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();
        result = { songs };
        break;
      }

      case "increment_plays": {
        if (!songId) throw new Error("songId required");
        // Only increment for valid ObjectIds
        if (!/^[0-9a-fA-F]{24}$/.test(songId)) {
          result = { success: true };
          break;
        }
        await db.collection("songs").updateOne(
          { _id: new ObjectId(songId) },
          { $inc: { plays: 1 } }
        );
        result = { success: true };
        break;
      }

      case "add_song": {
        if (!data) throw new Error("song data required");
        const insertResult = await db.collection("songs").insertOne({
          ...data,
          plays: 0,
          createdAt: new Date(),
        });
        result = { success: true, songId: insertResult.insertedId.toString() };
        break;
      }

      case "update_song": {
        if (!songId || !data) throw new Error("songId and data required");
        await db.collection("songs").updateOne(
          { _id: new ObjectId(songId) },
          { $set: { ...data, updatedAt: new Date() } }
        );
        result = { success: true };
        break;
      }

      case "delete_song": {
        if (!songId) throw new Error("songId required");
        await db.collection("songs").deleteOne({ _id: new ObjectId(songId) });
        result = { success: true };
        break;
      }

      // ============ ARTISTS ============
      case "get_all_artists": {
        const artists = await db.collection("artists")
          .find({})
          .sort({ name: 1 })
          .toArray();
        result = { artists };
        break;
      }

      case "get_artist": {
        if (!artistId) throw new Error("artistId required");
        const artist = await db.collection("artists").findOne({ 
          _id: new ObjectId(artistId) 
        });
        result = { artist };
        break;
      }

      case "search_artists": {
        if (!search) throw new Error("search query required");
        const artists = await db.collection("artists")
          .find({ name: { $regex: search, $options: "i" } })
          .limit(limit)
          .toArray();
        result = { artists };
        break;
      }

      case "add_artist": {
        if (!data) throw new Error("artist data required");
        const insertResult = await db.collection("artists").insertOne({
          ...data,
          createdAt: new Date(),
        });
        result = { success: true, artistId: insertResult.insertedId.toString() };
        break;
      }

      case "update_artist": {
        if (!artistId || !data) throw new Error("artistId and data required");
        await db.collection("artists").updateOne(
          { _id: new ObjectId(artistId) },
          { $set: { ...data, updatedAt: new Date() } }
        );
        result = { success: true };
        break;
      }

      case "delete_artist": {
        if (!artistId) throw new Error("artistId required");
        await db.collection("artists").deleteOne({ _id: new ObjectId(artistId) });
        result = { success: true };
        break;
      }

      // ============ ALBUMS ============
      case "get_albums": {
        const albums = await db.collection("albums")
          .find(query || {})
          .sort({ releaseDate: -1 })
          .limit(limit)
          .toArray();
        result = { albums };
        break;
      }

      case "get_album": {
        const albumId = data?.albumId as string;
        if (!albumId) throw new Error("albumId required");
        const album = await db.collection("albums").findOne({ 
          _id: new ObjectId(albumId) 
        });
        result = { album };
        break;
      }

      // ============ FEATURED ============
      case "get_featured": {
        const featured = await db.collection("featured")
          .find({ active: true })
          .sort({ order: 1 })
          .toArray();
        result = { featured };
        break;
      }

      // ============ STATS ============
      case "get_library_stats": {
        const [songCount, artistCount, albumCount] = await Promise.all([
          db.collection("songs").countDocuments({}),
          db.collection("artists").countDocuments({}),
          db.collection("albums").countDocuments({}),
        ]);
        result = { 
          stats: {
            songs: songCount,
            artists: artistCount,
            albums: albumCount
          }
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await client.close();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("MongoDB Error:", error);
    try { await client.close(); } catch (_) {}
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
