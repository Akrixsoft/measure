package org.json;
import java.util.*;
/** Minimal org.json stand-in for JVM tests: parser + accessors used by Updater. Integers parse to Integer/Long, fractions to Double (as org.json). */
public class JSONObject {
    public static final Object NULL = new Object() { @Override public String toString() { return "null"; } };
    final LinkedHashMap<String, Object> map = new LinkedHashMap<>();
    public JSONObject() { }
    public JSONObject(Map<String, ?> m) { for (Map.Entry<String, ?> e : m.entrySet()) map.put(e.getKey(), e.getValue()); }
    public JSONObject(String s) { P p = new P(s); Object o = p.value(); p.ws(); if (!(o instanceof JSONObject) || p.i != s.length()) throw new JSONException("not an object"); map.putAll(((JSONObject) o).map); }
    public Object opt(String k) { return map.get(k); }
    public boolean has(String k) { return map.containsKey(k); }
    public String optString(String k, String d) { Object o = map.get(k); return o == null || o == NULL ? d : o.toString(); }
    public JSONArray optJSONArray(String k) { Object o = map.get(k); return o instanceof JSONArray ? (JSONArray) o : null; }
    public JSONObject optJSONObject(String k) { Object o = map.get(k); return o instanceof JSONObject ? (JSONObject) o : null; }
    public int optInt(String k) { Object o = map.get(k); return o instanceof Number ? ((Number) o).intValue() : 0; }
    Object need(String k) { Object o = map.get(k); if (o == null) throw new JSONException("missing " + k); return o; }
    public String getString(String k) { Object o = need(k); if (o instanceof String) return (String) o; throw new JSONException("not string " + k); }
    public long getLong(String k) { Object o = need(k); if (o instanceof Number) return ((Number) o).longValue(); throw new JSONException("not number " + k); }
    public JSONObject getJSONObject(String k) { Object o = need(k); if (o instanceof JSONObject) return (JSONObject) o; throw new JSONException("not object " + k); }
    public JSONArray getJSONArray(String k) { Object o = need(k); if (o instanceof JSONArray) return (JSONArray) o; throw new JSONException("not array " + k); }
    public JSONObject put(String k, Object v) { if (v instanceof Collection) v = new JSONArray((Collection<?>) v); else if (v instanceof Map) { @SuppressWarnings("unchecked") Map<String, ?> m = (Map<String, ?>) v; v = new JSONObject(m); } map.put(k, v); return this; }
    public Object remove(String k) { return map.remove(k); }
    public Iterator<String> keys() { return map.keySet().iterator(); }
    public static String quote(String s) { StringBuilder b = new StringBuilder("\""); for (char c : s.toCharArray()) { if (c == '"' || c == '\\') b.append('\\').append(c); else if (c < 0x20) b.append(String.format("\\u%04x", (int) c)); else b.append(c); } return b.append('"').toString(); }
    static String write(Object o) { return o instanceof String ? quote((String) o) : String.valueOf(o); }
    @Override public String toString() { StringBuilder b = new StringBuilder("{"); boolean f = true; for (Map.Entry<String, Object> e : map.entrySet()) { if (!f) b.append(','); f = false; b.append(quote(e.getKey())).append(':').append(write(e.getValue())); } return b.append('}').toString(); }
    static final class P {
        final String s; int i; P(String s) { this.s = s; }
        void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
        char peek() { ws(); if (i >= s.length()) throw new JSONException("eof"); return s.charAt(i); }
        Object value() {
            char c = peek();
            if (c == '{') { i++; JSONObject o = new JSONObject(); if (peek() == '}') { i++; return o; } while (true) { if (peek() != '"') throw new JSONException("key"); String k = str(); if (peek() != ':') throw new JSONException(":"); i++; o.map.put(k, value()); char d = peek(); i++; if (d == '}') return o; if (d != ',') throw new JSONException(","); } }
            if (c == '[') { i++; JSONArray a = new JSONArray(); if (peek() == ']') { i++; return a; } while (true) { a.list.add(value()); char d = peek(); i++; if (d == ']') return a; if (d != ',') throw new JSONException(","); } }
            if (c == '"') return str();
            if (s.startsWith("true", i)) { i += 4; return Boolean.TRUE; }
            if (s.startsWith("false", i)) { i += 5; return Boolean.FALSE; }
            if (s.startsWith("null", i)) { i += 4; return NULL; }
            int st = i; while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
            String n = s.substring(st, i); if (n.isEmpty()) throw new JSONException("value at " + st);
            if (n.contains(".") || n.contains("e") || n.contains("E")) return Double.valueOf(n);
            long l = Long.parseLong(n); return l == (int) l ? (Object) (int) l : (Object) l;
        }
        String str() { i++; StringBuilder b = new StringBuilder(); while (true) { char c = s.charAt(i++); if (c == '"') return b.toString(); if (c == '\\') { char e = s.charAt(i++); switch (e) { case 'n': b.append('\n'); break; case 't': b.append('\t'); break; case 'r': b.append('\r'); break; case 'b': b.append('\b'); break; case 'f': b.append('\f'); break; case 'u': b.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; break; default: b.append(e); } } else b.append(c); } }
    }
}
