import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Key;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.cert.Certificate;
import java.util.Base64;
import java.util.Enumeration;

/**
 * Measure 82.18 (аудит M3): подпись манифеста обновления version.json ключом, которым подписан APK (тот же keystore).
 * Запуск без сборки (JDK 11+): java scripts/ManifestSign.java sign|verify <keystore> <password> <alias|-> <version.json>
 *   sign   → <version.json>.sig — Base64 подписи точных байтов файла; алгоритм — по ключу: RSA → SHA256withRSA, EC → SHA256withECDSA, DSA → SHA256withDSA
 *   verify → код 0, если <version.json>.sig верна для открытого ключа сертификата того же alias
 *   cert   → DER сертификата alias в stdout-файл <version.json> (вспомогательное: путь вывода вместо манифеста)
 * <password> — сам пароль или env:ИМЯ (из переменной окружения). Пароль ключа = пароль хранилища (как signingConfig в android/app/build.gradle). alias "-" → первая запись с закрытым ключом.
 * Тот же алгоритм проверяет android/.../Updater.java (verifyManifest) открытым ключом сертификата подписи установленного приложения.
 */
public class ManifestSign {
    static String alg(Key k) {
        switch (k.getAlgorithm()) {
            case "RSA": return "SHA256withRSA";
            case "EC": return "SHA256withECDSA";
            case "DSA": return "SHA256withDSA";
            default: throw new IllegalArgumentException("ключ " + k.getAlgorithm() + " не поддержан");
        }
    }

    static KeyStore load(String path, char[] pw) throws Exception {
        byte[] raw = Files.readAllBytes(Path.of(path));
        Exception last = null;
        for (String type : new String[]{"PKCS12", "JKS"}) {
            try (InputStream in = new ByteArrayInputStream(raw)) { KeyStore ks = KeyStore.getInstance(type); ks.load(in, pw); return ks; } catch (Exception e) { last = e; }
        }
        throw last;
    }

    static String alias(KeyStore ks, String a) throws Exception {
        if (!"-".equals(a)) { if (!ks.isKeyEntry(a)) throw new IllegalArgumentException("нет ключа " + a); return a; }
        for (Enumeration<String> e = ks.aliases(); e.hasMoreElements(); ) { String x = e.nextElement(); if (ks.isKeyEntry(x)) return x; }
        throw new IllegalArgumentException("в хранилище нет закрытого ключа");
    }

    public static void main(String[] a) throws Exception {
        if (a.length != 5) { System.err.println("usage: sign|verify|cert <keystore> <password> <alias|-> <file>"); System.exit(2); }
        char[] pw = (a[2].startsWith("env:") ? System.getenv(a[2].substring(4)) : a[2]).toCharArray();   // env:AK_PW — пароль не в командной строке
        KeyStore ks = load(a[1], pw);
        String al = alias(ks, a[3]);
        Path file = Path.of(a[4]), sig = Path.of(a[4] + ".sig");
        Certificate cert = ks.getCertificate(al);
        switch (a[0]) {
            case "sign": {
                PrivateKey k = (PrivateKey) ks.getKey(al, pw);
                Signature s = Signature.getInstance(alg(k)); s.initSign(k); s.update(Files.readAllBytes(file));
                Files.write(sig, Base64.getEncoder().encodeToString(s.sign()).getBytes(StandardCharsets.US_ASCII));
                // самопроверка сертификатом того же alias (его открытый ключ — в подписи APK)
                if (!verify(cert.getPublicKey(), Files.readAllBytes(file), Files.readAllBytes(sig))) throw new IllegalStateException("самопроверка подписи не прошла");
                System.out.println("signed " + file + " (" + alg(k) + ", alias " + al + ")");
                break;
            }
            case "verify": {
                boolean ok = Files.isRegularFile(sig) && verify(cert.getPublicKey(), Files.readAllBytes(file), Files.readAllBytes(sig));
                System.out.println((ok ? "OK " : "FAIL ") + "signature " + sig);
                System.exit(ok ? 0 : 1);
            }
            case "cert": Files.write(file, cert.getEncoded()); break;
            default: System.err.println("unknown mode " + a[0]); System.exit(2);
        }
    }

    static boolean verify(PublicKey pub, byte[] data, byte[] sigB64) {
        try {
            byte[] sig = Base64.getDecoder().decode(new String(sigB64, StandardCharsets.US_ASCII).trim());
            Signature s = Signature.getInstance(alg(pub)); s.initVerify(pub); s.update(data); return s.verify(sig);
        } catch (Exception e) { return false; }
    }
}
