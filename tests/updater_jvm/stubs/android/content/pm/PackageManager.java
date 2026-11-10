package android.content.pm;
public class PackageManager {
    public static class NameNotFoundException extends Exception { }
    public static final int GET_SIGNATURES = 0x40, GET_SIGNING_CERTIFICATES = 0x08000000;
    public PackageInfo installed = new PackageInfo();
    public int lastFlags;
    public PackageInfo getPackageInfo(String pkg, int flags) throws NameNotFoundException { lastFlags |= flags; return installed; }
    public PackageInfo getPackageArchiveInfo(String path, int flags) { return null; }
}
