import { MongoClient, ObjectId } from "npm:mongodb@6";
import { corsHeaders } from "../_shared/cors.ts";

const MONGODB_URI = Deno.env.get("MONGODB_URI")!;

interface RequestBody {
  action: string;
  collection: string;
  userId?: string;
  data?: Record<string, unknown>;
  query?: Record<string, unknown>;
  songId?: string;
  artistId?: string;
  playlistId?: string;
  limit?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    const body: RequestBody = await req.json();
    const { action, collection, userId, data, query, songId, artistId, playlistId, limit = 50 } = body;

    await client.connect();
    const db = client.db("rangebeat1");
    const col = db.collection(collection);

    let result: unknown;

    switch (action) {
      case "init_collections": {
        result = { 
          success: true, 
          message: "Collections initialized",
          collections: ["users", "favorites", "recently_played", "playlists", "user_profiles", "follows"]
        };
        break;
      }

      // ============ FAVORITES ============
      case "get_favorites": {
        if (!userId) throw new Error("userId required");
        const favorites = await col
          .find({ userId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();
        result = { favorites };
        break;
      }

      case "add_favorite": {
        if (!userId || !songId) throw new Error("userId and songId required");
        const existing = await col.findOne({ userId, songId });
        if (existing) {
          result = { success: true, message: "Already favorited" };
        } else {
          await col.insertOne({
            userId,
            songId,
            createdAt: new Date(),
          });
          result = { success: true };
        }
        break;
      }

      case "remove_favorite": {
        if (!userId || !songId) throw new Error("userId and songId required");
        await col.deleteOne({ userId, songId });
        result = { success: true };
        break;
      }

      case "check_favorite": {
        if (!userId || !songId) throw new Error("userId and songId required");
        const fav = await col.findOne({ userId, songId });
        result = { isFavorite: !!fav };
        break;
      }

      case "add_external_favorite": {
        if (!userId || !songId) throw new Error("userId and songId required");
        const existing = await col.findOne({ userId, songId });
        if (existing) {
          result = { success: true, message: "Already favorited" };
        } else {
          await col.insertOne({
            userId,
            songId,
            isExternal: true,
            metadata: data?.metadata || null,
            createdAt: new Date(),
          });
          result = { success: true };
        }
        break;
      }

      case "get_user_favorites_ids": {
        if (!userId) throw new Error("userId required");
        const favs = await col.find({ userId }).toArray();
        result = { songIds: favs.map((f: any) => f.songId) };
        break;
      }

      // ============ USER SYNC ============
      case "sync_user": {
        if (!userId || !data) throw new Error("userId and data required");
        const usersCol = db.collection("users");
        
        const existing = await usersCol.findOne({ odurerId: userId });
        if (existing) {
          await usersCol.updateOne(
            { odurerId: userId },
            {
              $set: {
                email: data.email,
                displayName: data.displayName || null,
                role: data.role || "user",
                lastLoginAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );
        } else {
          await usersCol.insertOne({
            odurerId: userId,
            email: data.email,
            displayName: data.displayName || null,
            role: data.role || "user",
            lastLoginAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        result = { success: true };
        break;
      }

      case "get_user": {
        if (!userId) throw new Error("userId required");
        const usersCol = db.collection("users");
        const user = await usersCol.findOne({ odurerId: userId });
        result = { user };
        break;
      }

      case "update_user_role": {
        if (!userId || !data?.role) throw new Error("userId and role required");
        const usersCol = db.collection("users");
        await usersCol.updateOne(
          { odurerId: userId },
          { $set: { role: data.role, updatedAt: new Date() } }
        );
        result = { success: true };
        break;
      }

      case "get_all_users": {
        const usersCol = db.collection("users");
        const users = await usersCol.find({}).sort({ createdAt: -1 }).limit(limit).toArray();
        result = { users };
        break;
      }

      // ============ RECENTLY PLAYED ============
      case "get_recently_played": {
        if (!userId) throw new Error("userId required");
        const history = await col
          .find({ userId })
          .sort({ playedAt: -1 })
          .limit(limit)
          .toArray();
        result = { history };
        break;
      }

      case "add_recently_played": {
        if (!userId || !songId) throw new Error("userId and songId required");
        const existing = await col.findOne({ userId, songId });
        if (existing) {
          await col.updateOne(
            { userId, songId },
            { $set: { playedAt: new Date() } }
          );
        } else {
          await col.insertOne({
            userId,
            songId,
            playedAt: new Date(),
          });
        }
        result = { success: true };
        break;
      }

      case "clear_recently_played": {
        if (!userId) throw new Error("userId required");
        await col.deleteMany({ userId });
        result = { success: true };
        break;
      }

      case "add_recently_played_with_metadata": {
        if (!userId || !songId) throw new Error("userId and songId required");
        const metadata = data?.metadata || null;
        const existing = await col.findOne({ userId, songId });
        if (existing) {
          await col.updateOne(
            { userId, songId },
            { $set: { playedAt: new Date(), metadata } }
          );
        } else {
          await col.insertOne({
            userId,
            songId,
            isExternal: true,
            metadata,
            playedAt: new Date(),
          });
        }
        result = { success: true };
        break;
      }

      // ============ PLAYLISTS ============
      case "get_playlists": {
        if (!userId) throw new Error("userId required");
        const playlists = await col
          .find({ userId })
          .sort({ createdAt: -1 })
          .toArray();
        result = { playlists };
        break;
      }

      case "get_playlist": {
        if (!playlistId) throw new Error("playlistId required");
        const playlist = await col.findOne({ _id: new ObjectId(playlistId) });
        result = { playlist };
        break;
      }

      case "create_playlist": {
        if (!userId || !data?.name) throw new Error("userId and name required");
        const insertResult = await col.insertOne({
          userId,
          name: data.name,
          description: data.description || "",
          coverUrl: data.coverUrl || null,
          isPublic: data.isPublic || false,
          songs: [],
          songMetadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        result = { success: true, playlistId: insertResult.insertedId.toString() };
        break;
      }

      case "update_playlist": {
        if (!playlistId) throw new Error("playlistId required");
        await col.updateOne(
          { _id: new ObjectId(playlistId) },
          { 
            $set: { 
              ...data,
              updatedAt: new Date()
            }
          }
        );
        result = { success: true };
        break;
      }

      case "delete_playlist": {
        if (!playlistId) throw new Error("playlistId required");
        await col.deleteOne({ _id: new ObjectId(playlistId) });
        result = { success: true };
        break;
      }

      case "add_song_to_playlist": {
        if (!playlistId || !songId) throw new Error("playlistId and songId required");
        await col.updateOne(
          { _id: new ObjectId(playlistId) },
          { 
            $addToSet: { songs: songId },
            $set: { updatedAt: new Date() }
          }
        );
        result = { success: true };
        break;
      }

      case "add_song_to_playlist_with_metadata": {
        if (!playlistId || !songId) throw new Error("playlistId and songId required");
        const metadata = data?.metadata || null;
        // Store metadata with BOTH the original key and dot-safe key for reliable retrieval
        const metaKey = `songMetadata.${songId}`;
        const safeMeta: Record<string, unknown> = {
          [metaKey]: metadata,
          updatedAt: new Date(),
        };
        // Also store with dot-safe key if different
        const safeKey = songId.replace(/\./g, "_");
        if (safeKey !== songId) {
          safeMeta[`songMetadata.${safeKey}`] = metadata;
        }
        await col.updateOne(
          { _id: new ObjectId(playlistId) },
          { 
            $addToSet: { songs: songId },
            $set: safeMeta
          }
        );
        result = { success: true };
        break;
      }

      case "remove_song_from_playlist": {
        if (!playlistId || !songId) throw new Error("playlistId and songId required");
        const metaKey = `songMetadata.${songId.replace(/\./g, "_")}`;
        await col.updateOne(
          { _id: new ObjectId(playlistId) },
          { 
            $pull: { songs: songId } as any,
            $unset: { [metaKey]: "" },
            $set: { updatedAt: new Date() }
          }
        );
        result = { success: true };
        break;
      }

      // ============ USER PROFILES ============
      case "get_profile": {
        if (!userId) throw new Error("userId required");
        const profile = await col.findOne({ userId });
        result = { profile };
        break;
      }

      case "upsert_profile": {
        if (!userId) throw new Error("userId required");
        const existing = await col.findOne({ userId });
        if (existing) {
          await col.updateOne(
            { userId },
            { $set: { ...data, userId, updatedAt: new Date() } }
          );
        } else {
          await col.insertOne({
            ...data,
            userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        result = { success: true };
        break;
      }

      case "get_user_stats": {
        if (!userId) throw new Error("userId required");
        const [favCount, playCount, playlistCount] = await Promise.all([
          db.collection("favorites").countDocuments({ userId }),
          db.collection("recently_played").countDocuments({ userId }),
          db.collection("playlists").countDocuments({ userId }),
        ]);
        result = { 
          stats: {
            totalFavorites: favCount,
            totalPlays: playCount,
            playlistCount
          }
        };
        break;
      }

      // ============ FOLLOWS ============
      case "get_follows": {
        if (!userId) throw new Error("userId required");
        const follows = await col.find({ userId }).toArray();
        result = { follows };
        break;
      }

      case "follow_artist": {
        if (!userId || !artistId) throw new Error("userId and artistId required");
        const existing = await col.findOne({ userId, artistId });
        if (!existing) {
          await col.insertOne({
            userId,
            artistId,
            createdAt: new Date(),
          });
        }
        result = { success: true };
        break;
      }

      case "unfollow_artist": {
        if (!userId || !artistId) throw new Error("userId and artistId required");
        await col.deleteOne({ userId, artistId });
        result = { success: true };
        break;
      }

      case "check_following": {
        if (!userId || !artistId) throw new Error("userId and artistId required");
        const follow = await col.findOne({ userId, artistId });
        result = { isFollowing: !!follow };
        break;
      }

      // ============ SITE SETTINGS ============
      case "get_site_settings": {
        const settingsCol = db.collection("site_settings");
        const settings = await settingsCol.findOne({ key: "about_us" });
        result = { settings: settings?.value || null };
        break;
      }

      case "update_site_settings": {
        if (!data) throw new Error("data required");
        const settingsCol = db.collection("site_settings");
        const existing = await settingsCol.findOne({ key: "about_us" });
        if (existing) {
          await settingsCol.updateOne(
            { key: "about_us" },
            { $set: { value: data, updatedAt: new Date() } }
          );
        } else {
          await settingsCol.insertOne({
            key: "about_us",
            value: data,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        result = { success: true };
        break;
      }

      // ============ GENERIC OPERATIONS ============
      case "find": {
        const docs = await col.find(query || {}).limit(limit).toArray();
        result = { documents: docs };
        break;
      }

      case "findOne": {
        const doc = await col.findOne(query || {});
        result = { document: doc };
        break;
      }

      case "insert": {
        if (!data) throw new Error("data required");
        const insertRes = await col.insertOne({
          ...data,
          createdAt: new Date(),
        });
        result = { success: true, insertedId: insertRes.insertedId.toString() };
        break;
      }

      case "update": {
        if (!query || !data) throw new Error("query and data required");
        await col.updateOne(query, { $set: { ...data, updatedAt: new Date() } });
        result = { success: true };
        break;
      }

      case "delete": {
        if (!query) throw new Error("query required");
        await col.deleteOne(query);
        result = { success: true };
        break;
      }

      case "count": {
        const count = await col.countDocuments(query || {});
        result = { count };
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
