package ge.akrix.zamer;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Only cache/camera, cache/exports and (read-only, AKX-2026-0014) cache/apk files are exposed, through explicit URI grants. */
public class LabFileProvider extends ContentProvider {
    @Override public boolean onCreate(){return true;}
    File file(Uri uri)throws FileNotFoundException{
        try{
            String path=uri.getPath();if(path==null||(!path.startsWith("/camera/")&&!path.startsWith("/exports/")&&!path.startsWith("/apk/")))throw new FileNotFoundException();
            File root=getContext().getCacheDir().getCanonicalFile(),f=new File(root,path.substring(1)).getCanonicalFile();
            if(!f.getPath().startsWith(root.getPath()+File.separator))throw new FileNotFoundException();
            return f;
        }catch(Exception error){throw new FileNotFoundException("Invalid Measure Lab file");}
    }
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{if(uri.getPath()!=null&&uri.getPath().startsWith("/apk/")&&!"r".equals(mode))throw new FileNotFoundException("read-only");return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.parseMode(mode));}
    @Override public String getType(Uri uri){String p=uri.getPath();return p!=null&&p.endsWith(".jpg")?"image/jpeg":p!=null&&p.startsWith("/apk/")&&p.endsWith(".apk")?"application/vnd.android.package-archive":"application/json";}
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){
        try{File f=file(uri);String[] cols=projection==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:projection;MatrixCursor c=new MatrixCursor(cols);Object[] values=new Object[cols.length];for(int i=0;i<cols.length;i++)values[i]=OpenableColumns.DISPLAY_NAME.equals(cols[i])?f.getName():OpenableColumns.SIZE.equals(cols[i])?f.length():null;c.addRow(values);return c;}catch(Exception e){return null;}
    }
    @Override public int delete(Uri uri,String selection,String[] args){if(uri.getPath()!=null&&uri.getPath().startsWith("/apk/"))return 0;try{return file(uri).delete()?1:0;}catch(Exception error){return 0;}}
    @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException();}
    @Override public int update(Uri uri,ContentValues values,String selection,String[] args){throw new UnsupportedOperationException();}
}
