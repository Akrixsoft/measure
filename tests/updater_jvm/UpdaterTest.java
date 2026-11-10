package ge.akrix.zamer;

import android.content.Context;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.content.res.AssetManager;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * AKX-2026-0014: JVM test of the real android/.../Updater.java (compiled against tests/updater_jvm/stubs).
 * Covers: built-in fallback, pending → trial → ready → active, SHA tamper fallback, unready-trial rollback,
 * ready-timeout rollback to previous, minApk gate, cleanup of versions ≤ built-in, downloadWeb (local copy path and
 * offline failure), manifest validation, URL allow-list, version compare, corrupt pointer.
 * 82.18 (аудит M3): подпись манифеста — валидная / подменённая / отсутствующая / чужим ключом; подпись CI-скрипта (scripts/sign_manifest.py)
 * проверяется Updater.verifyManifest сертификатом «установленного приложения» (stub PackageManager: GET_SIGNING_CERTIFICATES / GET_SIGNATURES).
 * Args: <staged assets root containing experimental/> <published dir with version.json + version.json.sig + web/<ver>/> <test keystore> <password> <cert DER>
 */
public class UpdaterTest {
    static int pass, fail;
    static void check(boolean ok, String name) { if (ok) pass++; else fail++; System.out.println((ok ? "PASS " : "FAIL ") + name); }

    static Path assets, published, work;
    static JSONObject pub;
    static String builtin;
    static int run;
    static byte[] certDer; static PrivateKey key;
    static byte[] sign(byte[] raw) { return sign(raw, key); }
    static byte[] sign(byte[] raw, PrivateKey k) {
        try { java.security.Signature s = java.security.Signature.getInstance("SHA256withRSA"); s.initSign(k); s.update(raw); return Base64.getEncoder().encode(s.sign()); }
        catch (Exception e) { throw new RuntimeException(e); }
    }

    static Context ctx(long installedCode) throws IOException {
        Context c = new Context();
        Path d = work.resolve("dev" + (run));
        c.filesDir = d.resolve("files").toFile(); c.cacheDir = d.resolve("cache").toFile();
        c.filesDir.mkdirs(); c.cacheDir.mkdirs();
        c.assets = new AssetManager(assets.toFile());
        c.pm = new PackageManager(); c.pm.installed.versionCode = (int) installedCode; c.pm.installed.versionName = builtin; c.pm.installed.packageName = c.pkg;
        Signature[] app = {new Signature(certDer)}; c.pm.installed.signingInfo = new SigningInfo(app); c.pm.installed.signatures = app;   // сертификат подписи «APK»
        return c;
    }
    /** Same device (filesDir) — new process. */
    static Updater relaunch(Context c) { return new Updater(c); }

    static String read(InputStream in) throws IOException { try (InputStream i = in) { ByteArrayOutputStream o = new ByteArrayOutputStream(); i.transferTo(o); return o.toString(StandardCharsets.UTF_8); } }

    /** Writes filesDir/web-<v>/ from the published bundle, manifest version rewritten to v. */
    static void installBundle(Context c, String v, long minApk, Consumer<JSONObject> mutate) throws IOException {
        File dir = new File(c.filesDir, "web-" + v); dir.mkdirs();
        JSONArray files = pub.getJSONArray("files");
        Path src = published.resolve(pub.getString("base"));
        for (int i = 0; i < files.length(); i++) { String p = files.getJSONObject(i).getString("path"); File t = new File(dir, p); t.getParentFile().mkdirs(); Files.copy(src.resolve(p), t.toPath()); }
        JSONObject m = new JSONObject(pub.toString()); m.remove("apk"); m.put("version", v); m.put("base", "web/" + v + "/"); m.put("minApk", minApk);
        if (mutate != null) mutate.accept(m);
        Files.writeString(new File(dir, "version.json").toPath(), m.toString());
        byte[] raw = m.toString().getBytes(StandardCharsets.UTF_8);   // [UPD-SIGN] подписанные байты + подпись рядом
        Files.write(new File(dir, Updater.SRC).toPath(), raw); Files.write(new File(dir, Updater.SIG).toPath(), sign(raw));
    }
    static void pointer(Context c, String active, String previous, String pending) throws IOException {
        JSONObject o = new JSONObject();
        o.put("active", active == null ? JSONObject.NULL : active); o.put("previous", previous == null ? JSONObject.NULL : previous);
        o.put("pending", pending == null ? JSONObject.NULL : pending); o.put("trial", JSONObject.NULL);
        o.put("failed", new JSONArray()); o.put("launches", new JSONObject());
        Files.writeString(new File(c.filesDir, "web-current.json").toPath(), o.toString());
    }
    static JSONObject ptr(Context c) throws IOException { return new JSONObject(Files.readString(new File(c.filesDir, "web-current.json").toPath())); }

    public static void main(String[] a) throws Exception {
        assets = Path.of(a[0]); published = Path.of(a[1]);
        KeyStore ks = KeyStore.getInstance("PKCS12"); try (InputStream in = Files.newInputStream(Path.of(a[2]))) { ks.load(in, a[3].toCharArray()); }
        key = (PrivateKey) ks.getKey("akrix", a[3].toCharArray()); certDer = Files.readAllBytes(Path.of(a[4]));
        work = Files.createTempDirectory("akx14-jvm");
        pub = new JSONObject(Files.readString(published.resolve("version.json")));
        builtin = new JSONObject(Files.readString(assets.resolve("experimental/version.json"))).getString("version");
        long code = pub.getJSONObject("apk").getLong("versionCode");
        String builtinIndex = Files.readString(assets.resolve("experimental/index.html"));

        // T1 built-in only
        run = 1; Context c = ctx(code); Updater u = relaunch(c);
        check(builtin.equals(u.builtinVersion), "built-in version read from assets/experimental/version.json (" + builtin + ")");
        Updater.Bundle b = u.resolve();
        check(b.dir == null && builtin.equals(b.version) && !b.trial, "no download → built-in assets");
        check(builtinIndex.equals(read(u.open("/index.html"))), "built-in index.html served");

        // T2 pending → trial → ready → active; relaunch keeps it
        run = 2; c = ctx(code); installBundle(c, "82.99", code, null); pointer(c, null, null, "82.99");
        u = relaunch(c); b = u.resolve();
        check(b.dir != null && "82.99".equals(b.version) && b.trial, "pending verified bundle starts as trial");
        check(u.open("/lab-update.js") != null && u.open("/not-in-manifest.js") == null, "only manifest files are served from the bundle");
        check(!u.ready("82.98"), "ready with another version is ignored");
        check(u.ready("82.99"), "ready(82.99) accepted");
        JSONObject p = ptr(c);
        check("82.99".equals(p.optString("active", "")) && p.opt("trial") == JSONObject.NULL, "after ready: active=82.99, no trial");
        u = relaunch(c); b = u.resolve();
        check("82.99".equals(b.version) && !b.trial && b.dir != null, "next launch serves active 82.99 (not trial)");
        check(u.served == b && "82.99".equals(u.state().getString("version")) && "downloaded".equals(u.state().getString("source")), "state(): served version/source");

        // T3 tampered file → fallback to built-in (same origin, data untouched by design)
        Path f = c.filesDir.toPath().resolve("web-82.99/lab-update.js");
        Files.writeString(f, Files.readString(f) + "\n//x");
        u = relaunch(c); b = u.resolve();
        check(b.dir == null && builtin.equals(b.version), "SHA-256 mismatch in active bundle → built-in");

        // T4 trial never reports ready (crash/kill) → retry once, then failed
        run = 4; c = ctx(code); installBundle(c, "82.99", code, null); pointer(c, null, null, "82.99");
        b = relaunch(c).resolve(); check(b.trial, "L1: trial");
        b = relaunch(c).resolve(); check(b.dir == null, "L2: previous launch unready → built-in this launch");
        b = relaunch(c).resolve(); check(b.trial && "82.99".equals(b.version), "L3: second (last) trial");
        b = relaunch(c).resolve(); check(b.dir == null, "L4: unready again → built-in");
        p = ptr(c); check(p.toString().contains("\"failed\":[\"82.99\"]"), "82.99 marked failed after " + Updater.MAX_UNREADY_LAUNCHES + " unready launches");
        b = relaunch(c).resolve(); check(b.dir == null && !new File(c.filesDir, "web-82.99").exists(), "L5: built-in, failed bundle removed");

        // T5 ready timeout → previous good version on next launch
        run = 5; c = ctx(code); installBundle(c, "82.98", code, null); installBundle(c, "82.99", code, null); pointer(c, "82.98", null, "82.99");
        u = relaunch(c); b = u.resolve(); check(b.trial && "82.99".equals(b.version), "new version on trial, 82.98 active");
        check(u.trialTimedOut(), "ready timeout handled");
        check(!u.ready("82.99"), "late ready after timeout is not accepted");
        b = relaunch(c).resolve(); check("82.98".equals(b.version) && b.dir != null, "after timeout: previous verified 82.98 served");

        // T6 minApk gate
        run = 6; c = ctx(code); installBundle(c, "82.99", code + 1, null); pointer(c, null, null, "82.99");
        b = relaunch(c).resolve(); check(b.dir == null, "bundle with minApk > installed versionCode is not served");

        // T7 versions ≤ built-in are ignored and cleaned (e.g. after APK update)
        run = 7; c = ctx(code); installBundle(c, builtin, code, null); pointer(c, builtin, null, null);
        b = relaunch(c).resolve(); check(b.dir == null && !new File(c.filesDir, "web-" + builtin).exists(), "active ≤ built-in → built-in served, dir cleaned");

        // T8 downloadWeb: every file identical to built-in → copied locally (no network), verified, pending
        run = 8; c = ctx(code); u = relaunch(c); u.resolve();
        JSONObject m = new JSONObject(pub.toString()); m.put("version", "82.99"); m.put("base", "web/82.99/");
        byte[] mraw = m.toString().getBytes(StandardCharsets.UTF_8);
        u.downloadWeb(m, mraw, sign(mraw));
        p = ptr(c); check("82.99".equals(p.optString("pending", "")), "downloadWeb → pending=82.99");
        check(new File(c.filesDir, "web-82.99/" + Updater.SRC).isFile() && new File(c.filesDir, "web-82.99/" + Updater.SIG).isFile(), "downloadWeb stores signed manifest bytes + signature");
        String[] tmp = c.filesDir.list((d, n) -> n.startsWith("web-tmp-"));
        check(tmp != null && tmp.length == 0 && new File(c.filesDir, "web-82.99/version.json").isFile(), "atomic: tmp renamed to web-82.99, no leftovers");
        check(!Files.readString(new File(c.filesDir, "web-82.99/version.json").toPath()).contains("\"apk\""), "local manifest stores no apk section");
        b = relaunch(c).resolve(); check(b.trial && "82.99".equals(b.version), "applied at next launch as trial");

        // T9 downloadWeb offline (a file must be fetched) → exception, nothing pending, no tmp
        run = 9; c = ctx(code); u = relaunch(c); u.resolve();
        m = new JSONObject(pub.toString()); m.put("version", "82.99"); m.put("base", "web/82.99/");
        m.getJSONArray("files").getJSONObject(0).put("sha256", "0".repeat(64));
        boolean threw = false; try { byte[] r9 = m.toString().getBytes(StandardCharsets.UTF_8); u.downloadWeb(m, r9, sign(r9)); } catch (Exception e) { threw = true; }
        tmp = c.filesDir.list((d, n) -> n.startsWith("web-"));
        check(threw && (tmp == null || tmp.length == 0) && !new File(c.filesDir, "web-current.json").exists(), "offline/failed download leaves no state and no files");
        check(relaunch(c).resolve().dir == null, "after failed download: built-in still served");

        // T10 corrupt pointer
        run = 10; c = ctx(code); Files.writeString(new File(c.filesDir, "web-current.json").toPath(), "{not json");
        check(relaunch(c).resolve().dir == null, "corrupt web-current.json → built-in, no crash");

        // T11 manifest validation mirror + URL allow-list
        check(Updater.validManifest(pub, true) == null, "published manifest valid in Java");
        List<String[]> bad = new ArrayList<>();
        String[][] cases = {
            {"files.0.path", "../x.js"}, {"files.0.path", "/abs.js"}, {"files.0.path", "version.json"}, {"files.0.sha256", "ABC"},
            {"version", "82.x"}, {"base", "web/other/"}, {"apk.url", "http://raw.githubusercontent.com/Akrixsoft/measure/measure-lab-apk/measure-82.17.apk"},
            {"apk.url", "https://evil.example/Akrixsoft/measure/measure-lab-apk/measure-82.17.apk"}, {"apk.url", Updater.BASE + "payload.apk"},
            {"apk.sha256", "0"}, {"format", "x"}};
        for (String[] k : cases) {
            JSONObject x = new JSONObject(pub.toString()); String[] path = k[0].split("\\.");
            JSONObject t = x; for (int i = 0; i < path.length - 1; i++) t = "files".equals(path[i]) ? x.getJSONArray("files").getJSONObject(Integer.parseInt(path[++i])) : t.optJSONObject(path[i]);
            t.put(path[path.length - 1], k[1]);
            if (Updater.validManifest(x, true) == null) bad.add(k);
        }
        check(bad.isEmpty(), "invalid manifests rejected (" + cases.length + " cases)" + (bad.isEmpty() ? "" : " accepted: " + bad.get(0)[0]));
        JSONObject x = new JSONObject(pub.toString()); x.put("v", Boolean.TRUE); check(Updater.validManifest(x, true) != null, "v=true rejected");
        x = new JSONObject(pub.toString()); x.put("minApk", 1.5); check(Updater.validManifest(x, true) != null, "fractional minApk rejected");
        String[] urls = {"http://raw.githubusercontent.com/Akrixsoft/measure/measure-lab-apk/version.json", "https://raw.githubusercontent.com.evil.io/Akrixsoft/measure/measure-lab-apk/x",
            "https://raw.githubusercontent.com:444/Akrixsoft/measure/measure-lab-apk/x", "https://raw.githubusercontent.com/Other/measure/measure-lab-apk/x", Updater.BASE + "../main/x"};
        int rejected = 0; for (String s : urls) try { Updater.checkUrl(s); } catch (IOException e) { rejected++; }
        boolean okUrl = true; try { Updater.checkUrl(Updater.BASE + "version.json?t=1"); } catch (IOException e) { okUrl = false; }
        check(rejected == urls.length && okUrl, "URL allow-list: only https://raw.githubusercontent.com/Akrixsoft/measure/measure-lab-apk/");

        // T12 version compare
        check(Updater.vcmp("82.18.1", "82.18") > 0 && Updater.vcmp("82.9", "82.10") < 0 && Updater.vcmp("82.18", "82.18.0") == 0 && Updater.vcmp("82.18", "0") > 0, "vcmp numeric segments");

        // T13 [UPD-SIGN] подпись манифеста (аудит M3)
        run = 13; c = ctx(code); u = relaunch(c);
        byte[] praw = Files.readAllBytes(published.resolve("version.json")), psig = Files.readAllBytes(published.resolve("version.json.sig"));
        check(u.verifyManifest(praw, psig), "sig: version.json signed by CI script (scripts/sign_manifest.py) verifies with the app signing certificate");
        check((c.pm.lastFlags & PackageManager.GET_SIGNING_CERTIFICATES) != 0, "sig: API ≥ 28 reads GET_SIGNING_CERTIFICATES");
        byte[] tam = praw.clone(); tam[tam.length / 2] ^= 1;
        check(!u.verifyManifest(tam, psig), "sig: tampered manifest (1 bit) rejected");
        check(!u.verifyManifest(praw, null) && !u.verifyManifest(praw, new byte[0]), "sig: missing signature rejected");
        check(!u.verifyManifest(praw, "not base64 !!".getBytes(StandardCharsets.US_ASCII)), "sig: garbage signature rejected");
        KeyPairGenerator kg = KeyPairGenerator.getInstance("RSA"); kg.initialize(2048);
        check(!u.verifyManifest(praw, sign(praw, kg.generateKeyPair().getPrivate())), "sig: signature by another key rejected");
        c.pm.installed.signingInfo = null; c.pm.installed.signatures = null;
        check(!u.verifyManifest(praw, psig), "sig: no app signing certificate → rejected");
        android.os.Build.VERSION.SDK_INT = 27; c = ctx(code); c.pm.installed.signingInfo = null; u = relaunch(c);
        check(u.verifyManifest(praw, psig) && (c.pm.lastFlags & PackageManager.GET_SIGNATURES) != 0, "sig: API < 28 → GET_SIGNATURES");
        android.os.Build.VERSION.SDK_INT = 34;
        // бундл в папке: подпись проверяется при каждом использовании
        run = 14; c = ctx(code); installBundle(c, "82.99", code, null); pointer(c, "82.99", null, null);
        check(relaunch(c).resolve().dir != null, "sig: signed bundle served");
        Path src = c.filesDir.toPath().resolve("web-82.99/" + Updater.SRC); String good = Files.readString(src);
        Files.writeString(src, good.replace("\"minApk\":" + code, "\"minApk\":1"));
        check(!good.equals(Files.readString(src)) && relaunch(c).resolve().dir == null, "sig: signed manifest changed on device → built-in");
        run = 15; c = ctx(code); installBundle(c, "82.99", code, null); pointer(c, "82.99", null, null);
        Files.delete(c.filesDir.toPath().resolve("web-82.99/" + Updater.SIG));
        check(relaunch(c).resolve().dir == null, "sig: bundle without signature → built-in");
        run = 16; c = ctx(code); u = relaunch(c); u.resolve();
        m = new JSONObject(pub.toString()); m.put("version", "82.99"); m.put("base", "web/82.99/");
        byte[] r16 = m.toString().getBytes(StandardCharsets.UTF_8); threw = false;
        try { u.downloadWeb(m, r16, sign(r16, kg.generateKeyPair().getPrivate())); } catch (Exception e) { threw = true; }
        check(threw && !new File(c.filesDir, "web-82.99").exists() && !new File(c.filesDir, "web-current.json").exists(), "sig: downloadWeb with foreign signature refused, nothing stored");

        System.out.println(pass + " passed, " + fail + " failed");
        System.exit(fail == 0 ? 0 : 1);
    }
}
