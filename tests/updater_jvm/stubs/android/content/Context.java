package android.content;
/** JVM test stub (AKX-2026-0014): only what Updater uses. */
public class Context {
    public java.io.File filesDir, cacheDir; public android.content.res.AssetManager assets; public android.content.pm.PackageManager pm; public String pkg = "ge.akrix.measure";
    public Context getApplicationContext() { return this; }
    public java.io.File getFilesDir() { return filesDir; }
    public java.io.File getCacheDir() { return cacheDir; }
    public android.content.res.AssetManager getAssets() { return assets; }
    public android.content.pm.PackageManager getPackageManager() { return pm; }
    public String getPackageName() { return pkg; }
}
