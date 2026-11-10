package android.content.pm;
public class PackageManager {
    public static class NameNotFoundException extends Exception { }
    public PackageInfo installed = new PackageInfo();
    public PackageInfo getPackageInfo(String pkg, int flags) throws NameNotFoundException { return installed; }
    public PackageInfo getPackageArchiveInfo(String path, int flags) { return null; }
}
