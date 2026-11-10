package android.content.res;
/** JVM test stub: assets served from a directory. */
public class AssetManager {
    final java.io.File root; public AssetManager(java.io.File root) { this.root = root; }
    public java.io.InputStream open(String name) throws java.io.IOException { return new java.io.FileInputStream(new java.io.File(root, name)); }
}
