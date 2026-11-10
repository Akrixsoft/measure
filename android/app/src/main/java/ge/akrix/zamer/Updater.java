package ge.akrix.zamer;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * AKX-2026-0014 — автообновление Measure.
 * ═══ [BLOCK UPD-SOURCE] только HTTPS raw.githubusercontent.com/Akrixsoft/measure/measure-lab-apk/, без редиректов, без секретов.
 * ═══ [BLOCK UPD-MANIFEST] version.json: {format, v, version, minApk, base, files:[{path,sha256,size}], apk:{versionCode,versionName,url,sha256,size}};
 *     правила проверки совпадают со scripts/web_bundle.py validate_manifest.
 * ═══ [BLOCK UPD-STORE] filesDir/web-&lt;ver&gt;/ — проверенные файлы + version.json; указатель filesDir/web-current.json (запись tmp → rename).
 *     Состояние: active (работает), previous (откат), pending (скачано, применится при запуске), trial (запущено, ждёт ready).
 * ═══ [BLOCK UPD-SERVE] страница всегда открывается с https://experimental.measure-lab.local/ — тот же origin, IndexedDB/localStorage те же;
 *     меняется только источник файлов: проверенная папка или встроенные assets/experimental/.
 * ═══ [BLOCK UPD-ROLLBACK] trial без ready за READY_TIMEOUT_MS → failed; при следующем запуске — previous/встроенная.
 */
final class Updater {
    static final String HOST = "raw.githubusercontent.com";
    static final String BASE = "https://" + HOST + "/Akrixsoft/measure/measure-lab-apk/";
    static final String FORMAT = "measure-web-bundle";
    static final long MAX_MANIFEST = 512L * 1024, MAX_FILE = 20L << 20, MAX_APK = 200L << 20;
    static final int MAX_FILES = 500, READY_TIMEOUT_MS = 25000, MAX_UNREADY_LAUNCHES = 2;
    static final Pattern VERSION = Pattern.compile("^\\d{1,4}(\\.\\d{1,4}){1,3}$");
    static final Pattern PATH = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(/[A-Za-z0-9][A-Za-z0-9._-]{0,127}){0,3}$");
    static final Pattern SHA = Pattern.compile("^[0-9a-f]{64}$");
    static final Pattern APK_NAME = Pattern.compile("^measure-\\d{1,4}(\\.\\d{1,4}){1,3}\\.apk$");
    static final String ASSET_DIR = "experimental";

    interface Events { void event(JSONObject event); }

    /** The web bundle served to the WebView. dir == null → built-in assets. */
    static final class Bundle {
        final String version; final File dir; final Map<String, File> files; final boolean trial;
        Bundle(String version, File dir, Map<String, File> files, boolean trial) { this.version = version; this.dir = dir; this.files = files; this.trial = trial; }
        String source() { return dir == null ? "builtin" : "downloaded"; }
    }

    final Context ctx;
    final File files, pointer;
    final ExecutorService io = Executors.newSingleThreadExecutor();
    final AtomicBoolean busy = new AtomicBoolean();
    volatile Bundle served;
    volatile JSONObject offeredApk;
    volatile Events events;
    String builtinVersion = "0";
    final Map<String, String> builtinSha = new HashMap<>();

    Updater(Context ctx) {
        this.ctx = ctx.getApplicationContext();
        files = this.ctx.getFilesDir();
        pointer = new File(files, "web-current.json");
        try (InputStream in = this.ctx.getAssets().open(ASSET_DIR + "/version.json")) {
            JSONObject m = new JSONObject(new String(readAll(in, MAX_MANIFEST), StandardCharsets.UTF_8));
            if (validManifest(m, false) == null) {
                builtinVersion = m.getString("version");
                JSONArray list = m.getJSONArray("files");
                for (int i = 0; i < list.length(); i++) builtinSha.put(list.getJSONObject(i).getString("path"), list.getJSONObject(i).getString("sha256"));
            }
        } catch (Exception ignored) { /* dev build without staged version.json — built-in = "0", every valid download is newer */ }
    }

    // ───────────────────────── version helpers
    static int vcmp(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? Integer.parseInt(x[i]) : 0, q = i < y.length ? Integer.parseInt(y[i]) : 0;
            if (p != q) return p < q ? -1 : 1;
        }
        return 0;
    }
    long installedCode() {
        try {
            PackageInfo p = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
        } catch (PackageManager.NameNotFoundException e) { return 0; }
    }
    String installedName() {
        try { return ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }

    // ───────────────────────── [BLOCK UPD-MANIFEST] validation (mirror of scripts/web_bundle.py)
    static boolean isInt(Object o) { return o instanceof Integer || o instanceof Long; }
    /** @return null if valid, otherwise the first error. */
    static String validManifest(JSONObject m, boolean published) {
        try {
            if (!FORMAT.equals(m.opt("format")) || !Integer.valueOf(1).equals(m.opt("v"))) return "format/v";
            Object ver = m.opt("version");
            if (!(ver instanceof String) || !VERSION.matcher((String) ver).matches()) return "version";
            Object min = m.opt("minApk");
            if (!isInt(min) || ((Number) min).longValue() < 1) return "minApk";
            Object list = m.opt("files");
            if (!(list instanceof JSONArray) || ((JSONArray) list).length() == 0 || ((JSONArray) list).length() > MAX_FILES) return "files";
            Set<String> seen = new HashSet<>();
            JSONArray a = (JSONArray) list;
            for (int i = 0; i < a.length(); i++) {
                Object o = a.get(i);
                if (!(o instanceof JSONObject)) return "file entry";
                JSONObject f = (JSONObject) o;
                Object p = f.opt("path"), s = f.opt("sha256"), n = f.opt("size");
                if (!(p instanceof String) || !PATH.matcher((String) p).matches() || ((String) p).contains("..") || "version.json".equals(p)) return "path";
                if (!seen.add((String) p)) return "duplicate";
                if (!(s instanceof String) || !SHA.matcher((String) s).matches()) return "sha256";
                if (!isInt(n) || ((Number) n).longValue() < 0 || ((Number) n).longValue() > MAX_FILE) return "size";
            }
            if (!seen.contains("index.html") || !seen.contains("lab-version.js")) return "missing entry";
            if (published) {
                if (!("web/" + ver + "/").equals(m.opt("base"))) return "base";
                Object apk = m.opt("apk");
                if (apk != null && apk != JSONObject.NULL) {
                    if (!(apk instanceof JSONObject)) return "apk";
                    JSONObject k = (JSONObject) apk;
                    Object code = k.opt("versionCode"), name = k.opt("versionName"), url = k.opt("url"), sha = k.opt("sha256"), size = k.opt("size");
                    if (!isInt(code) || ((Number) code).longValue() < 1) return "apk.versionCode";
                    if (!(name instanceof String) || !VERSION.matcher((String) name).matches()) return "apk.versionName";
                    if (!(url instanceof String) || !((String) url).startsWith(BASE) || !APK_NAME.matcher(((String) url).substring(BASE.length())).matches()) return "apk.url";
                    if (!(sha instanceof String) || !SHA.matcher((String) sha).matches()) return "apk.sha256";
                    if (!isInt(size) || ((Number) size).longValue() < 1 || ((Number) size).longValue() > MAX_APK) return "apk.size";
                }
            }
            return null;
        } catch (Exception e) { return "parse"; }
    }

    // ───────────────────────── [BLOCK UPD-STORE] pointer state
    static final class State {
        String active, previous, pending, trial;
        final Set<String> failed = new HashSet<>();
        final Map<String, Integer> launches = new HashMap<>();
    }
    synchronized State load() {
        State s = new State();
        try (InputStream in = new FileInputStream(pointer)) {
            JSONObject o = new JSONObject(new String(readAll(in, 64 * 1024), StandardCharsets.UTF_8));
            s.active = ver(o, "active"); s.previous = ver(o, "previous"); s.pending = ver(o, "pending"); s.trial = ver(o, "trial");
            JSONArray f = o.optJSONArray("failed");
            if (f != null) for (int i = 0; i < f.length(); i++) if (VERSION.matcher(f.optString(i)).matches()) s.failed.add(f.optString(i));
            JSONObject l = o.optJSONObject("launches");
            if (l != null) for (Iterator<String> it = l.keys(); it.hasNext(); ) { String k = it.next(); if (VERSION.matcher(k).matches()) s.launches.put(k, l.optInt(k)); }
        } catch (Exception ignored) { /* no pointer → built-in */ }
        return s;
    }
    static String ver(JSONObject o, String key) { String v = o.optString(key, ""); return VERSION.matcher(v).matches() ? v : null; }
    synchronized void save(State s) throws IOException {
        try {
            JSONObject o = new JSONObject();
            o.put("active", s.active == null ? JSONObject.NULL : s.active); o.put("previous", s.previous == null ? JSONObject.NULL : s.previous);
            o.put("pending", s.pending == null ? JSONObject.NULL : s.pending); o.put("trial", s.trial == null ? JSONObject.NULL : s.trial);
            o.put("failed", new JSONArray(s.failed)); o.put("launches", new JSONObject(s.launches));
            File tmp = new File(files, "web-current.json.tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(o.toString().getBytes(StandardCharsets.UTF_8)); out.getFD().sync(); }
            if (!tmp.renameTo(pointer)) throw new IOException("pointer rename");
        } catch (org.json.JSONException e) { throw new IOException(e); }
    }
    File dirOf(String version) { return new File(files, "web-" + version); }

    /** Verify a downloaded bundle directory against its own version.json: every listed file, SHA-256 and size. */
    Bundle verified(String version, boolean trial) {
        if (version == null) return null;
        File dir = dirOf(version);
        try (InputStream in = new FileInputStream(new File(dir, "version.json"))) {
            JSONObject m = new JSONObject(new String(readAll(in, MAX_MANIFEST), StandardCharsets.UTF_8));
            if (validManifest(m, true) != null || !version.equals(m.getString("version"))) return null;
            if (m.getLong("minApk") > installedCode()) return null;
            Map<String, File> map = new HashMap<>();
            JSONArray list = m.getJSONArray("files");
            for (int i = 0; i < list.length(); i++) {
                JSONObject f = list.getJSONObject(i);
                File file = new File(dir, f.getString("path"));
                if (!file.isFile() || file.length() != f.getLong("size")) return null;
                try (InputStream fin = new FileInputStream(file)) { if (!f.getString("sha256").equals(hash(fin, null, f.getLong("size")))) return null; }
                map.put(f.getString("path"), file);
            }
            return new Bundle(version, dir, map, trial);
        } catch (Exception e) { return null; }
    }

    /** Called at every page load (UI thread). Applies pending → trial, rolls back unready trials, picks the newest verified bundle. */
    synchronized Bundle resolve() {
        State s = load();
        boolean dirty = false;
        if (s.trial != null) {   // previous launch never reported ready
            int n = s.launches.containsKey(s.trial) ? s.launches.get(s.trial) : 0;
            if (n >= MAX_UNREADY_LAUNCHES) { s.failed.add(s.trial); s.launches.remove(s.trial); }
            else if (s.pending == null) s.pending = s.trial;  // one more try on the launch after this one
            s.trial = null; dirty = true;
            Bundle b = choose(s); persist(s, dirty); return served = b;   // this launch: previous / built-in
        }
        if (s.pending != null) {
            String p = s.pending; s.pending = null; dirty = true;
            if (!s.failed.contains(p) && vcmp(p, builtinVersion) > 0) {
                Bundle t = verified(p, true);
                if (t != null) {
                    s.trial = p; s.launches.put(p, (s.launches.containsKey(p) ? s.launches.get(p) : 0) + 1);
                    persist(s, true); cleanup(s); return served = t;
                }
            }
        }
        Bundle b = choose(s);
        persist(s, dirty); cleanup(s);
        return served = b;
    }
    Bundle choose(State s) {
        for (String v : new String[]{s.active, s.previous}) {
            if (v == null || s.failed.contains(v) || vcmp(v, builtinVersion) <= 0) continue;
            Bundle b = verified(v, false);
            if (b != null) return b;
        }
        return new Bundle(builtinVersion, null, null, false);
    }
    void persist(State s, boolean dirty) { if (dirty) try { save(s); } catch (IOException ignored) { } }

    /** JS bridge "ready": the page loaded its scripts and opened IndexedDB. */
    synchronized boolean ready(String version) {
        Bundle b = served;
        if (b == null || !b.version.equals(version)) return false;
        if (!b.trial) return true;
        State s = load();
        if (!b.version.equals(s.trial)) return false;
        if (s.active != null && !s.active.equals(b.version)) s.previous = s.active;
        s.active = b.version; s.trial = null; s.launches.remove(b.version);
        try { save(s); } catch (IOException e) { return false; }
        served = new Bundle(b.version, b.dir, b.files, false);
        cleanup(s);
        return true;
    }
    /** Trial did not report ready within READY_TIMEOUT_MS. */
    synchronized boolean trialTimedOut() {
        Bundle b = served;
        if (b == null || !b.trial) return false;
        State s = load();
        if (b.version.equals(s.trial)) { s.failed.add(b.version); s.trial = null; s.launches.remove(b.version); if (b.version.equals(s.pending)) s.pending = null; persist(s, true); }
        return true;
    }
    /** "Перезапустить": make pending current for the next resolve() (same as a new launch). */
    synchronized boolean hasPending() { return load().pending != null; }

    void cleanup(State s) {
        Set<String> keep = new HashSet<>();
        for (String v : new String[]{s.active, s.previous, s.pending, s.trial}) if (v != null) keep.add("web-" + v);
        File[] list = files.listFiles();
        if (list == null) return;
        for (File f : list) {
            String n = f.getName();
            if (!f.isDirectory() || !n.startsWith("web-") || keep.contains(n)) continue;
            if (busy.get() && n.startsWith("web-tmp-")) continue;   // download in progress
            deleteTree(f);
        }
    }
    static void deleteTree(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteTree(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    // ───────────────────────── [BLOCK UPD-SERVE]
    /** Stream for a page path ("/index.html"); null → 404. Runs on WebView IO thread. */
    InputStream open(String path) throws IOException {
        Bundle b = served;
        String rel = path.startsWith("/") ? path.substring(1) : path;
        if (b != null && b.dir != null) {
            File f = b.files.get(rel);
            return f == null ? null : new FileInputStream(f);
        }
        return ctx.getAssets().open(ASSET_DIR + "/" + rel);
    }

    // ───────────────────────── [BLOCK UPD-SOURCE] network
    static void checkUrl(String url) throws IOException {
        URL u = new URL(url);
        if (!"https".equals(u.getProtocol()) || !HOST.equals(u.getHost()) || (u.getPort() != -1 && u.getPort() != 443) || !url.startsWith(BASE) || url.contains(".."))
            throw new IOException("URL not allowed");
    }
    interface Progress { void at(long done, long total); }
    /** GET url (HTTPS, fixed host, no redirects) into out; returns SHA-256 hex. */
    static String fetch(String url, OutputStream out, long max, Progress progress) throws IOException {
        checkUrl(url);
        HttpsURLConnection c = (HttpsURLConnection) new URL(url).openConnection();
        try {
            c.setInstanceFollowRedirects(false); c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setUseCaches(false);
            c.setRequestProperty("Cache-Control", "no-cache"); c.setRequestProperty("Accept-Encoding", "identity");
            int code = c.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + code);
            long len = c.getContentLengthLong();
            if (len > max) throw new IOException("too large");
            try (InputStream in = c.getInputStream()) { return hash(in, out, max, progress, len); }
        } finally { c.disconnect(); }
    }
    static String hash(InputStream in, OutputStream out, long max) throws IOException { return hash(in, out, max, null, -1); }
    static String hash(InputStream in, OutputStream out, long max, Progress progress, long total) throws IOException {
        try {
            MessageDigest d = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[65536]; long n = 0; int r;
            while ((r = in.read(buf)) > 0) {
                n += r; if (n > max) throw new IOException("too large");
                d.update(buf, 0, r); if (out != null) out.write(buf, 0, r);
                if (progress != null) progress.at(n, total);
            }
            StringBuilder sb = new StringBuilder();
            for (byte b : d.digest()) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
    }
    static byte[] readAll(InputStream in, long max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); hash(in, out, max); return out.toByteArray();
    }

    // ───────────────────────── check + web download (background)
    void emit(String type, boolean manual, Object... kv) {
        Events e = events;
        if (e == null) return;
        try {
            JSONObject o = new JSONObject(); o.put("type", type); o.put("manual", manual);
            for (int i = 0; i + 1 < kv.length; i += 2) o.put((String) kv[i], kv[i + 1]);
            e.event(o);
        } catch (Exception ignored) { }
    }
    void checkAsync(boolean manual) {
        if (!busy.compareAndSet(false, true)) { if (manual) emit("busy", true); return; }
        io.execute(() -> { try { check(manual); } finally { busy.set(false); } });
    }
    void check(boolean manual) {
        emit("checking", manual);
        JSONObject m;
        try {
            ByteArrayOutputStream raw = new ByteArrayOutputStream();
            fetch(BASE + "version.json?t=" + (System.currentTimeMillis() / 60000), raw, MAX_MANIFEST, null);
            m = new JSONObject(new String(raw.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception e) { emit("offline", manual, "reason", String.valueOf(e.getMessage())); return; }
        String bad = validManifest(m, true);
        if (bad != null) { emit("error", manual, "reason", "манифест: " + bad); return; }
        boolean found = false;
        try {
            long installed = installedCode();
            String v = m.getString("version");
            State s = load();
            Bundle cur = served;
            String have = cur == null ? builtinVersion : cur.version;
            for (String x : new String[]{s.pending, s.active, builtinVersion}) if (x != null && vcmp(x, have) > 0) have = x;
            if (vcmp(v, have) > 0 && !s.failed.contains(v)) {
                if (m.getLong("minApk") <= installed) {
                    found = true;
                    emit("web-downloading", manual, "version", v);
                    downloadWeb(m);
                    emit("web-ready", manual, "version", v);
                } else emit("web-needs-apk", manual, "version", v, "minApk", m.getLong("minApk"));
            }
            JSONObject apk = m.optJSONObject("apk");
            if (apk != null && apk.getLong("versionCode") > installed) {
                found = true; offeredApk = apk;
                emit("apk-available", manual, "versionCode", apk.getLong("versionCode"), "versionName", apk.getString("versionName"), "size", apk.getLong("size"));
            }
            if (!found) emit("none", manual, "version", cur == null ? builtinVersion : cur.version, "apk", installedName());
        } catch (Exception e) { emit("web-failed", manual, "reason", String.valueOf(e.getMessage())); }
    }
    void downloadWeb(JSONObject m) throws Exception {
        String v = m.getString("version"), base = m.getString("base");
        File tmp = new File(files, "web-tmp-" + v + "-" + System.nanoTime());
        if (!tmp.mkdirs()) throw new IOException("mkdir");
        try {
            Bundle cur = served;
            JSONArray list = m.getJSONArray("files");
            for (int i = 0; i < list.length(); i++) {
                JSONObject f = list.getJSONObject(i);
                String path = f.getString("path"), sha = f.getString("sha256"); long size = f.getLong("size");
                File out = new File(tmp, path);
                File parent = out.getParentFile();
                if (parent == null || (!parent.isDirectory() && !parent.mkdirs())) throw new IOException("mkdir " + path);
                if (!out.getCanonicalPath().startsWith(tmp.getCanonicalPath() + File.separator)) throw new IOException("path " + path);
                String got = null;
                // identical file already on the device (built-in or current bundle) — copy, still re-hashed
                if (sha.equals(builtinSha.get(path))) got = copy(ctx.getAssets().open(ASSET_DIR + "/" + path), out, size);
                else if (cur != null && cur.files != null && cur.files.containsKey(path)) got = copy(new FileInputStream(cur.files.get(path)), out, size);
                if (!sha.equals(got)) try (OutputStream o = new FileOutputStream(out)) { got = fetch(BASE + base + path, o, size, null); }
                if (!sha.equals(got) || out.length() != size) throw new IOException("SHA-256 " + path);
            }
            JSONObject local = new JSONObject(m.toString()); local.remove("apk");
            try (FileOutputStream o = new FileOutputStream(new File(tmp, "version.json"))) { o.write(local.toString().getBytes(StandardCharsets.UTF_8)); o.getFD().sync(); }
            synchronized (this) {
                File dst = dirOf(v);
                State s = load();
                if (dst.exists() && !v.equals(s.active) && !v.equals(s.previous)) deleteTree(dst);
                if (!dst.exists() && !tmp.renameTo(dst)) throw new IOException("rename");
                if (verified(v, false) == null) { deleteTree(dst); throw new IOException("verify"); }
                if (!v.equals(s.active)) { s.pending = v; save(s); }
            }
        } finally { if (tmp.exists()) deleteTree(tmp); }
    }
    static String copy(InputStream in, File out, long size) {
        try (InputStream i = in; OutputStream o = new FileOutputStream(out)) { return hash(i, o, size); } catch (IOException e) { return null; }
    }

    // ───────────────────────── APK download (background), install is done by MainActivity
    interface ApkDone { void done(File apk); }
    void downloadApkAsync(ApkDone done) {
        JSONObject a = offeredApk;
        if (a == null) { emit("apk-failed", true, "reason", "нет данных об обновлении — проверьте обновления"); return; }
        if (!busy.compareAndSet(false, true)) { emit("busy", true); return; }
        io.execute(() -> {
            try {
                long code = a.getLong("versionCode"), size = a.getLong("size");
                File dir = new File(ctx.getCacheDir(), "apk");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("mkdir");
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) deleteTree(f);
                File part = new File(dir, "measure-" + code + ".part"), apk = new File(dir, "measure-" + code + ".apk");
                final long[] last = {-1};
                String got;
                try (OutputStream o = new FileOutputStream(part)) {
                    got = fetch(a.getString("url"), o, size, (n, t) -> { long pct = n * 100 / size; if (pct / 10 != last[0]) { last[0] = pct / 10; emit("apk-progress", true, "pct", pct); } });
                }
                if (!a.getString("sha256").equals(got) || part.length() != size) { deleteTree(part); throw new IOException("SHA-256 не совпадает"); }
                if (!part.renameTo(apk)) throw new IOException("rename");
                PackageInfo p = ctx.getPackageManager().getPackageArchiveInfo(apk.getPath(), 0);
                long pc = p == null ? -1 : Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
                if (p == null || !ctx.getPackageName().equals(p.packageName) || pc != code) { deleteTree(apk); throw new IOException("APK не того приложения/версии"); }
                emit("apk-ready", true, "versionName", a.getString("versionName"));
                done.done(apk);
            } catch (Exception e) { emit("apk-failed", true, "reason", String.valueOf(e.getMessage())); }
            finally { busy.set(false); }
        });
    }

    JSONObject state() {
        JSONObject o = new JSONObject();
        try {
            Bundle b = served; State s = load();
            o.put("version", b == null ? builtinVersion : b.version); o.put("source", b == null ? "builtin" : b.source()); o.put("trial", b != null && b.trial);
            o.put("builtin", builtinVersion); o.put("pending", s.pending == null ? JSONObject.NULL : s.pending);
            o.put("previous", s.previous == null ? JSONObject.NULL : s.previous);
            o.put("apkVersionCode", installedCode()); o.put("apkVersionName", installedName());
        } catch (Exception ignored) { }
        return o;
    }
}
