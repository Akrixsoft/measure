package android.content.pm;
public class PackageInfo { public int versionCode; public String versionName, packageName; public Signature[] signatures; public SigningInfo signingInfo; public long getLongVersionCode() { return versionCode; } }
