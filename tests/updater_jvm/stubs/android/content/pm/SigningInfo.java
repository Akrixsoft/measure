package android.content.pm;
public class SigningInfo { public Signature[] signers; public SigningInfo(Signature[] s) { signers = s; } public Signature[] getApkContentsSigners() { return signers; } public boolean hasMultipleSigners() { return signers != null && signers.length > 1; } }
