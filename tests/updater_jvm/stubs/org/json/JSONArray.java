package org.json;
import java.util.*;
/** Minimal org.json stand-in for JVM tests (semantics used by Updater only). */
public class JSONArray {
    final List<Object> list = new ArrayList<>();
    public JSONArray() { }
    public JSONArray(Collection<?> c) { list.addAll(c); }
    public int length() { return list.size(); }
    public Object get(int i) { if (i < 0 || i >= list.size()) throw new JSONException("index"); return list.get(i); }
    public JSONObject getJSONObject(int i) { Object o = get(i); if (o instanceof JSONObject) return (JSONObject) o; throw new JSONException("not object"); }
    public String optString(int i) { Object o = i < list.size() ? list.get(i) : null; return o == null || o == JSONObject.NULL ? "" : o.toString(); }
    public JSONArray put(Object o) { list.add(o); return this; }
    @Override public String toString() { StringBuilder b = new StringBuilder("["); for (int i = 0; i < list.size(); i++) { if (i > 0) b.append(','); b.append(JSONObject.write(list.get(i))); } return b.append(']').toString(); }
}
