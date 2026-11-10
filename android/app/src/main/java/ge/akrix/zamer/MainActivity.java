package ge.akrix.zamer;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONObject;

/** Isolated, offline test harness. Original Measure remains a different application. */
@SuppressLint("MissingPermission")
public class MainActivity extends Activity {
    static final boolean SINGLE = true;   /* Measure 82: преемник v81, без выбора версий */
    static final String V81_HOST = "v81.measure-lab.local";
    static final String LAB_HOST = "experimental.measure-lab.local";
    WebView web;
    Ble ble;
    BluetoothAdapter ad;
    boolean pendingBt, switching;
    volatile String activeVersion;
    ValueCallback<Uri[]> fileCb;
    Uri camUri;
    static final int RQ_FILE = 11, RQ_CAM = 12, RQ_PERM = 21, RQ_BT = 22;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        ad = manager == null ? null : manager.getAdapter();
        ble = ad == null ? null : new Ble(this, ad, new Ble.Out() {
            public void state(String st, String nm) { js("window.akrixBtState&&akrixBtState(" + q(st) + "," + (nm == null ? "null" : q(nm)) + ")"); }
            public void pkt(String hex) { js("window.akrixBtPkt&&akrixBtPkt(" + q(hex) + ")"); }
            public void msg(String t) { js("window.akrixBtMsg&&akrixBtMsg(" + q(t) + ")"); }
        });
        /* Measure 82: одно приложение — сразу рабочая версия, без экрана выбора */
        if (SINGLE) openVersion("experimental");
        else if (state != null && state.getString("activeVersion") != null) openVersion(state.getString("activeVersion"));
        else showChooser();
    }

    int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    TextView text(String value, int sp, int color) {
        TextView t = new TextView(this); t.setText(value); t.setTextSize(sp); t.setTextColor(color); return t;
    }
    void showChooser() {
        activeVersion = null; switching = false;
        if (fileCb != null) { fileCb.onReceiveValue(null); fileCb = null; }
        if (ble != null) { ble.disconnect(); ble.close(); }
        if (web != null) { web.removeJavascriptInterface("AkrixBT"); web.removeJavascriptInterface("AkrixApp"); web.removeJavascriptInterface("AkrixLab"); web.stopLoading(); web.destroy(); web = null; }
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(26), dp(42), dp(26), dp(28)); root.setBackgroundColor(Color.rgb(246,247,249));
        TextView brand = text("Measure 82.13", 29, Color.rgb(32,42,54)); root.addView(brand);
        TextView sub = text("Выберите версию для работы и сравнения", 15, Color.rgb(111,123,138));
        sub.setPadding(0, dp(13), 0, dp(30)); root.addView(sub);
        Button original = new Button(this); original.setText("Исходная v81"); original.setAllCaps(false);
        original.setOnClickListener(v -> openVersion("v81")); root.addView(original, new LinearLayout.LayoutParams(-1, dp(58)));
        TextView originalInfo = text("Снимок приложения без изменений. Работает без интернета.", 13, Color.rgb(117,127,139));
        originalInfo.setPadding(0,dp(8),0,dp(24)); root.addView(originalInfo);
        Button experimental = new Button(this); experimental.setText("Тестовая версия · Lab"); experimental.setAllCaps(false);
        experimental.setOnClickListener(v -> openVersion("experimental")); root.addView(experimental, new LinearLayout.LayoutParams(-1,dp(58)));
        TextView labInfo = text("Полноценная копия v81 с изменениями интерфейса, настроек и выгрузки.",13,Color.rgb(117,127,139));
        labInfo.setPadding(0,dp(8),0,dp(24));root.addView(labInfo);
        TextView note = text("У версий отдельные замеры и настройки. Установленный Measure не изменяется. Для сравнения используйте резервную копию / восстановление JSON в каждой версии.\n\nВернуться сюда можно кнопкой «Версии» или системной кнопкой «Назад» — после сохранения работы.",13,Color.rgb(108,120,136));
        note.setLineSpacing(dp(3),1); root.addView(note);
        setContentView(root);
    }

    @SuppressLint("SetJavaScriptEnabled")
    void openVersion(String version) {
        if (!"v81".equals(version) && !"experimental".equals(version)) return;
        activeVersion = version; switching = false;
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.WHITE);
        LinearLayout bar = new LinearLayout(this); bar.setGravity(Gravity.CENTER_VERTICAL); bar.setPadding(dp(10),0,dp(6),0); bar.setBackgroundColor(Color.rgb(242,244,247));
        TextView name = text("Measure Lab · " + ("v81".equals(version)?"v81":"тестовая"),12,Color.rgb(100,112,128));
        bar.addView(name,new LinearLayout.LayoutParams(0,dp(39),1)); name.setGravity(Gravity.CENTER_VERTICAL);
        Button choose = new Button(this); choose.setText("Версии"); choose.setTextSize(12); choose.setAllCaps(false); choose.setOnClickListener(v->requestChooser());
        bar.addView(choose,new LinearLayout.LayoutParams(dp(90),dp(39))); if (!SINGLE) root.addView(bar);
        web = new WebView(this); WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Bt(),"AkrixBT");web.addJavascriptInterface(new App(),"AkrixApp");web.addJavascriptInterface(new Lab(),"AkrixLab");
        web.setWebViewClient(new Client());web.setWebChromeClient(new Chrome());
        root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
        web.loadUrl("https://" + ("v81".equals(version)?V81_HOST:LAB_HOST) + "/index.html");
    }

    boolean trusted(Uri u) {
        return u != null && "https".equals(u.getScheme()) && (V81_HOST.equals(u.getHost()) || LAB_HOST.equals(u.getHost())) && (u.getPort() == -1 || u.getPort() == 443);
    }
    boolean sameOrigin(Uri u) { return trusted(u) && ("v81".equals(activeVersion)?V81_HOST:LAB_HOST).equals(u.getHost()); }
    boolean trustedPage() { return web != null && activeVersion != null && sameOrigin(Uri.parse(web.getUrl() == null ? "" : web.getUrl())); }
    WebResourceResponse blocked(int status, String reason) {
        return new WebResourceResponse("text/plain","UTF-8",status,reason,new HashMap<>(),new ByteArrayInputStream(reason.getBytes(StandardCharsets.UTF_8)));
    }
    class Client extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (!sameOrigin(u)) {
                // External API POSTs may be used by configured AI endpoints; arbitrary remote HTML/scripts never get native bridges.
                if (!request.isForMainFrame() && "POST".equals(request.getMethod()) && "https".equals(u.getScheme())) return null;
                return blocked(403,"Forbidden");
            }
            if (!"GET".equals(request.getMethod())) return blocked(405,"Method Not Allowed");
            String path = u.getPath();if(path == null || "/".equals(path))path="/index.html";
            if(path.contains("..") || path.contains("\\") || path.contains("\u0000"))return blocked(403,"Forbidden");
            String directory=V81_HOST.equals(u.getHost())?"v81":"experimental";
            try {
                InputStream stream=getAssets().open(directory+path);
                String mime=path.endsWith(".html")?"text/html":path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".png")?"image/png":path.endsWith(".jpg")?"image/jpeg":path.endsWith(".pdf")?"application/pdf":"application/octet-stream";
                Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-store");headers.put("X-Content-Type-Options","nosniff");
                headers.put("Content-Security-Policy","frame-src 'none'; object-src 'none'; base-uri 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' https:; img-src 'self' data: blob: content:; style-src 'self' 'unsafe-inline';");
                return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,stream);
            } catch(Exception error){return blocked(404,"Not Found");}
        }
        @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
            if(sameOrigin(request.getUrl()))return false;
            if(request.isForMainFrame() && ("https".equals(request.getUrl().getScheme()) || "http".equals(request.getUrl().getScheme()))) {
                new AlertDialog.Builder(MainActivity.this).setMessage("Открыть ссылку во внешнем браузере?").setNegativeButton("Отмена",null).setPositiveButton("Открыть",(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,request.getUrl()));}catch(ActivityNotFoundException error){toast("Нечем открыть ссылку");}}).show();
            }
            return true;
        }
    }

    void requestChooser() {
        if(web==null || activeVersion==null){showChooser();return;}if(switching)return;
        switching=true;
        // flushAll updates undo history; the explicit transaction afterwards detects write failures swallowed by v81 helpers.
        String code="(async()=>{for(const id of ['lab-arrow-editor','labModal']){const dialog=document.getElementById(id);if(dialog&&!dialog.hidden)throw Error('Завершите ввод или закройте окно')}const active=document.activeElement;if(active&&active.matches('input,textarea,select')){active.blur();await Promise.resolve();await new Promise(resolve=>setTimeout(resolve,0))}if(!window.PM||!PM.S||typeof DB==='undefined'||!DB.db)throw Error('Хранилище ещё не готово');if(PM.S.recomp||document.getElementById('busy')?.classList.contains('on'))throw Error('Дождитесь окончания обработки');if(PM.flushAll)await PM.flushAll();if(PM.saveNow)await PM.saveNow();await new Promise((resolve,reject)=>{const tx=DB.db.transaction('sess','readwrite'),st=tx.objectStore('sess');if(PM.S.room)st.put(JSON.parse(JSON.stringify(PM.S.room)));if(PM.S.sess)st.put(JSON.parse(JSON.stringify(PM.S.sess)));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error('Ошибка записи'));tx.onabort=()=>reject(tx.error||Error('Запись отменена'))});if(PM.lastPut)PM.lastPut();AkrixLab.readyToChoose()})().catch(e=>AkrixLab.saveFailed(String(e.message||e)))";
        web.evaluateJavascript(code,null);
        web.postDelayed(()->{if(switching){switching=false;toast("Сохранение не завершено. Останьтесь в версии и повторите позже.");}},15000);
    }
    class Lab {
        @JavascriptInterface public void chooseVersion(){runOnUiThread(()->{if(trustedPage())requestChooser();});}
        @JavascriptInterface public void readyToChoose(){runOnUiThread(()->{if(switching&&trustedPage()){if(SINGLE)finish();else showChooser();}});}
        @JavascriptInterface public void saveFailed(String message){runOnUiThread(()->{switching=false;toast("Не переключено: "+message);});}
    }
    void js(String code){runOnUiThread(()->{if(trustedPage())web.evaluateJavascript(code,null);});}
    static String q(String value){return JSONObject.quote(value);}

    class Chrome extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
            if(!trustedPage())return false;if(fileCb!=null)fileCb.onReceiveValue(null);fileCb=callback;
            try{
                if(params.isCaptureEnabled()){
                    File cameraDir=new File(getCacheDir(),"camera");if(!cameraDir.exists()&&!cameraDir.mkdirs())throw new IllegalStateException("Нет папки камеры");
                    File photo=File.createTempFile("measure-",".jpg",cameraDir);
                    camUri=new Uri.Builder().scheme("content").authority(getPackageName()+".files").appendPath("camera").appendPath(photo.getName()).build();
                    Intent intent=new Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT,camUri).addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    intent.setClipData(android.content.ClipData.newRawUri("Фото",camUri));startActivityForResult(intent,RQ_CAM);
                }else{
                    Intent intent=new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE);
                    String[] accept=params.getAcceptTypes();ArrayList<String> types=new ArrayList<>();boolean json=false;
                    if(accept!=null)for(String raw:accept)if(raw!=null)for(String type:raw.split(",")){type=type.trim();if(type.equals(".json")||type.equals("application/json")){json=true;types.add("application/json");}else if(type.contains("/"))types.add(type);}
                    if(json){intent.setType("*/*");}else if(types.size()==1){intent.setType(types.get(0));}else{intent.setType(types.isEmpty()?"*/*":"image/*");if(types.size()>1)intent.putExtra(Intent.EXTRA_MIME_TYPES,types.toArray(new String[0]));}
                    if(params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE)intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
                    startActivityForResult(Intent.createChooser(intent,json?"Файл замера / резервная копия":"Выбрать файл"),RQ_FILE);
                }
            }catch(Exception error){if(fileCb!=null)fileCb.onReceiveValue(null);fileCb=null;toast("Не открылось: "+error.getMessage());}
            return true;
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==RQ_BT){if(pendingBt){pendingBt=false;if(ad!=null&&ad.isEnabled()&&ble!=null)ble.scan();else if(ble!=null)ble.out.state("off",null);}return;}
        if(fileCb==null)return;Uri[] values=null;
        if(request==RQ_CAM){if(result==RESULT_OK&&camUri!=null)values=new Uri[]{camUri};else if(camUri!=null)try{getContentResolver().delete(camUri,null,null);}catch(Exception ignored){}camUri=null;}
        else if(request==RQ_FILE&&result==RESULT_OK&&data!=null){ArrayList<Uri> list=new ArrayList<>();if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)list.add(data.getClipData().getItemAt(i).getUri());else if(data.getData()!=null)list.add(data.getData());values=list.toArray(new Uri[0]);}
        fileCb.onReceiveValue(values);fileCb=null;
    }

    String[] perms(){return Build.VERSION.SDK_INT>=31?new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT}:new String[]{Manifest.permission.ACCESS_FINE_LOCATION};}
    boolean hasPerms(){for(String p:perms())if(checkSelfPermission(p)!=PackageManager.PERMISSION_GRANTED)return false;return true;}
    void btStart(){if(ble==null){js("window.akrixBtState&&akrixBtState('off',null);window.akrixBtMsg&&akrixBtMsg('Bluetooth нет на устройстве')");return;}if(!hasPerms()){pendingBt=true;requestPermissions(perms(),RQ_PERM);return;}if(!ad.isEnabled()){pendingBt=true;startActivityForResult(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE),RQ_BT);return;}ble.scan();}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==RQ_PERM&&pendingBt){pendingBt=false;if(hasPerms())btStart();else if(ble!=null){ble.out.state("off",null);ble.out.msg("Нет разрешения «Устройства поблизости»");}}}
    class Bt{
        @JavascriptInterface public void connect(){runOnUiThread(()->{if(trustedPage())btStart();});}
        @JavascriptInterface public void measure(){runOnUiThread(()->{if(trustedPage()&&ble!=null)ble.measure();});}
        @JavascriptInterface public void disconnect(){runOnUiThread(()->{if(trustedPage()&&ble!=null)ble.disconnect();});}
    }
    class App{
        @JavascriptInterface public void save(String name,String mime,String contents){runOnUiThread(()->{if(trustedPage())saveFile(name,mime,contents);});}
        @JavascriptInterface public String version(){return "Measure 82.13";}
    }
    void saveFile(String name,String mime,String contents){
        try{
            name=new File(name.replace('\\','/')).getName();if(name.isEmpty()||name.equals(".")||name.equals(".."))throw new IllegalArgumentException("Некорректное имя файла");
            Uri uri;String location;
            if(Build.VERSION.SDK_INT>=29){ContentValues values=new ContentValues();values.put(MediaStore.Downloads.DISPLAY_NAME,name);values.put(MediaStore.Downloads.MIME_TYPE,mime);values.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/Measure Lab");values.put(MediaStore.Downloads.IS_PENDING,1);uri=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);location="Загрузки/Measure Lab/";}
            else{File directory=new File(getCacheDir(),"exports");if(!directory.exists()&&!directory.mkdirs())throw new IllegalStateException("Нет папки выгрузки");File target=new File(directory,name);uri=new Uri.Builder().scheme("content").authority(getPackageName()+".files").appendPath("exports").appendPath(target.getName()).build();location="Файлы Measure Lab/";}
            if(uri==null)throw new IllegalStateException("Не удалось создать файл");
            try(OutputStream output=getContentResolver().openOutputStream(uri,"w")){if(output==null)throw new IllegalStateException("Не удалось записать файл");output.write(contents.getBytes(StandardCharsets.UTF_8));}
            if(Build.VERSION.SDK_INT>=29){ContentValues complete=new ContentValues();complete.put(MediaStore.Downloads.IS_PENDING,0);getContentResolver().update(uri,complete,null,null);}
            toast("Сохранено: "+location+name);
            Intent share=new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM,uri).putExtra(Intent.EXTRA_TITLE,name).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);share.setClipData(android.content.ClipData.newRawUri(name,uri));startActivity(Intent.createChooser(share,name));
        }catch(Exception error){toast("Не сохранено: "+error.getMessage());}
    }
    void toast(String value){Toast.makeText(this,value,Toast.LENGTH_LONG).show();}
    @Override protected void onSaveInstanceState(Bundle state){super.onSaveInstanceState(state);if(activeVersion!=null)state.putString("activeVersion",activeVersion);}
    @Override protected void onPause(){if(web!=null&&trustedPage())web.evaluateJavascript("window.PM&&PM.flushAll&&PM.flushAll()",null);super.onPause();}
    @Override protected void onDestroy(){if(ble!=null)ble.close();if(web!=null){web.destroy();web=null;}super.onDestroy();}
    @Override public void onBackPressed(){if(activeVersion!=null)requestChooser();else super.onBackPressed();}
}
