#!/usr/bin/env python3
"""Stage the two offline apps, compile and sign the isolated Measure Lab APK."""
from pathlib import Path
import glob, hashlib, json, os, secrets, shutil, subprocess, sys, zipfile
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[1]
TOOLS=ROOT/'tools'
BASELINE='b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191'
def run(cmd,**kw):
    return subprocess.run([str(x) for x in cmd],check=True,**kw)
def main():
    source=ROOT/'web/v81.html'
    if hashlib.sha256(source.read_bytes()).hexdigest()!=BASELINE:raise SystemExit('Original v81 changed; refusing to package.')
    assets=ROOT/'android/app/src/main/assets'
    for name,source_name in [('v81','v81.html'),('experimental','experimental.html')]:
        target=assets/name
        target.mkdir(parents=True,exist_ok=True)
        for item in target.iterdir():
            if item.is_file():item.unlink()
        shutil.copy2(ROOT/'web'/source_name,target/'index.html')
        shared=ROOT/'web/shared'
        if shared.exists():
            for item in shared.iterdir():
                if item.is_file():shutil.copy2(item,target/item.name)
        if name=='experimental':
            for pattern in ['lab-*.js','lab-*.css']:
                for item in (ROOT/'web').glob(pattern):shutil.copy2(item,target/item.name)
    env=os.environ.copy()
    jdk=Path(env.get('JAVA_HOME') or next(iter(sorted(glob.glob(str(TOOLS/'jdk-*')))),''))
    if not (jdk/'bin/javac').exists():raise SystemExit('A JDK is required: set JAVA_HOME or install tools/jdk-*.')
    sdk=Path(env.get('ANDROID_HOME',str(TOOLS/'android-sdk')))
    gradle=Path(env.get('MEASURE_GRADLE',str(TOOLS/'gradle-8.7/bin/gradle')))
    if not gradle.exists():raise SystemExit('Gradle 8.7 is required: set MEASURE_GRADLE.')
    env.update(JAVA_HOME=str(jdk),ANDROID_HOME=str(sdk),ANDROID_SDK_ROOT=str(sdk))
    env['PATH']=str(jdk/'bin')+os.pathsep+env.get('PATH','')
    proxy=urlsplit(env.get('HTTPS_PROXY') or env.get('https_proxy') or '')
    options=[]
    if proxy.hostname:
        port=proxy.port or 80
        options=[f'-Dhttps.proxyHost={proxy.hostname}',f'-Dhttps.proxyPort={port}',f'-Dhttp.proxyHost={proxy.hostname}',f'-Dhttp.proxyPort={port}']
    trust=Path('/etc/ssl/certs/java/cacerts')
    if trust.exists():options.append('-Djavax.net.ssl.trustStore='+str(trust))
    env['JAVA_TOOL_OPTIONS']=' '.join(options)
    signing=ROOT/'.signing';signing.mkdir(exist_ok=True)
    password=signing/'password';keystore=signing/'measure-lab.jks'
    if not password.exists():password.write_text(secrets.token_hex(24));password.chmod(0o600)
    if not keystore.exists():
        run([jdk/'bin/keytool','-genkeypair','-keystore',keystore,'-alias','measurelab','-keyalg','RSA','-keysize','2048','-validity','20000','-storepass:file',password,'-keypass:file',password,'-dname','CN=Measure Lab, O=Akrix Test, C=GE'],env=env)
        keystore.chmod(0o600)
    (ROOT/'android/local.properties').write_text('sdk.dir='+str(sdk)+'\n')
    run([gradle,'-p',ROOT/'android','-g',ROOT/'.gradle','assembleRelease','--no-daemon','--console=plain'],env=env)
    source_apk=ROOT/'android/app/build/outputs/apk/release/app-release.apk'
    output=ROOT/'artifacts';output.mkdir(exist_ok=True)
    apk=output/'measure-82.16.apk';shutil.copy2(source_apk,apk)
    manifest={}
    with zipfile.ZipFile(apk) as archive:
        for file in assets.rglob('*'):
            if not file.is_file():continue
            relative=file.relative_to(assets).as_posix()
            actual=archive.read('assets/'+relative)
            if actual!=file.read_bytes():raise SystemExit('Packaged asset mismatch: '+relative)
            manifest[relative]=hashlib.sha256(actual).hexdigest()
    if manifest.get('v81/index.html')!=BASELINE:raise SystemExit('Packaged v81 baseline integrity failure.')
    (output/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    digest=hashlib.sha256(apk.read_bytes()).hexdigest()
    (output/'measure-82.16.apk.sha256').write_text(digest+'  '+apk.name+'\n')
    run([sdk/'build-tools/34.0.0/apksigner','verify','--verbose','--print-certs',apk],env=env)
    print('APK:',apk,'\nSHA256:',digest)
if __name__=='__main__':main()
