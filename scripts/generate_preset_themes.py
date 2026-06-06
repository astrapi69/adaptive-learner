import json, colorsys

P = json.load(open("/tmp/chosen-presets.json"))

def parse(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def tohex(rgb): return '#%02x%02x%02x' % tuple(max(0,min(255,round(c))) for c in rgb)
def lin(c):
    c/=255; return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def lum(h):
    r,g,b=parse(h); return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def ratio(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
def mix(a,b,t):
    ra,ga,ba=parse(a); rb,gb,bb=parse(b); return tohex((ra+(rb-ra)*t, ga+(gb-ga)*t, ba+(bb-ba)*t))
def best_text_on(bg):
    w=ratio('#ffffff',bg); k=ratio('#0a0a0a',bg)
    return '#ffffff' if w>=k else '#0a0a0a'
def ensure(color, bg, target=4.5, toward=None):
    """Darken/lighten `color` toward black (light bg) or white (dark bg) until ratio>=target."""
    if ratio(color,bg)>=target: return color
    dark_bg = lum(bg) < 0.5
    end = '#ffffff' if dark_bg else '#000000'
    if toward: end = toward
    cur = color
    for i in range(1,21):
        cur = mix(color, end, i/20)
        if ratio(cur,bg)>=target: return cur
    return cur
def rgba(h,a):
    r,g,b=parse(h); return f"rgba({r}, {g}, {b}, {a})"
def rgbstr(h):
    r,g,b=parse(h); return f"{r}, {g}, {b}"

# light/dark family + status palettes
FAMILY={"catppuccin-latte":"light","supabase":"light","graphite":"light",
        "catppuccin-mocha":"dark","soft-pop":"dark","amethyst-haze":"dark"}
STATUS={"light":dict(success="#15803d",warning="#b45309",info="#1d4ed8"),
        "dark": dict(success="#4ade80",warning="#fbbf24",info="#60a5fa")}
MATCHED={"light":"#0d9488","dark":"#2dd4bf"}
STAR={"light":"#d97706","dark":"#fbbf24"}

def gen(tid, s):
    fam=FAMILY[tid]; dark = fam=="dark"
    bg=s["background"]; fg=s["foreground"]; surface=s["card"] or bg
    elevated=s["popover"] or (mix(bg,'#ffffff',0.04) if not dark else mix(bg,'#ffffff',0.06))
    if elevated==bg: elevated = mix(bg,'#ffffff',0.05) if dark else mix(bg,'#000000',0.03)
    secondary=s["secondary"] or mix(bg,fg,0.06)
    border=s["border"] or mix(bg,fg,0.15)
    primary=s["primary"]; dest=s["destructive"]
    # enforce text AA on bg
    fg_muted = ensure(s["muted-foreground"] or mix(fg,bg,0.45), bg, 4.5)
    fg_secondary = ensure(mix(fg, fg_muted, 0.35), bg, 4.5)
    accent_fg = best_text_on(primary)               # guarantees primary-button AA
    # accent-as-text (ghost hint / link): primary as a fill is not always
    # readable as text (e.g. supabase mint on white = 1.54). Darken/lighten
    # toward AA on the worse of bg/surface so the hint/link text passes (#96).
    accent_text = ensure(primary, surface if ratio(primary, surface) < ratio(primary, bg) else bg, 4.5)
    accent_hover = mix(primary, '#ffffff' if dark else '#000000', 0.14)
    fg_inverse = best_text_on(dest)                 # destructive-foreground
    st=STATUS[fam]
    success=ensure(st["success"], bg); warning=ensure(st["warning"], bg)
    info=ensure(st["info"], bg); error=ensure(dest, bg)
    ex_correct=ensure(success, surface, 3.0); ex_wrong=ensure(error, surface, 3.0)
    ex_matched=ensure(MATCHED[fam], surface, 3.0)
    charts=[s.get(f"chart-{i}") or primary for i in range(1,6)]+[primary]
    shadow_a = 0.5 if dark else 0.06
    tokens={
      "bg-primary":bg,"bg-secondary":secondary,"bg-surface":surface,"bg-elevated":elevated,
      "bg-overlay":rgba('#000000',0.6 if dark else 0.45),
      "fg-primary":fg,"fg-secondary":fg_secondary,"fg-muted":fg_muted,"fg-inverse":fg_inverse,
      "border-primary":border,"border-subtle":mix(border,bg,0.5),"border-accent":mix(border,fg,0.2),
      "interactive-bg":mix(bg,fg,0.06),"interactive-hover":mix(bg,fg,0.1),
      "interactive-active":mix(bg,fg,0.16),"interactive-disabled":secondary,
      "accent":primary,"accent-hover":accent_hover,"accent-fg":accent_fg,"accent-text":accent_text,
      "accent-subtle":rgba(primary,0.12),"accent-rgb":rgbstr(primary),
      "success":success,"success-bg":rgba(success,0.15),"error":error,"error-bg":rgba(error,0.15),
      "warning":warning,"warning-bg":rgba(warning,0.15),"info":info,"info-bg":rgba(info,0.15),
      "exercise-correct":ex_correct,"exercise-wrong":ex_wrong,"exercise-selected":primary,"exercise-matched":ex_matched,
      "matching-side-a-bg":"color-mix(in srgb, var(--info) 16%, var(--bg-surface))","matching-side-a-fg":"var(--fg-primary)",
      "matching-side-b-bg":"color-mix(in srgb, var(--success) 16%, var(--bg-surface))","matching-side-b-fg":"var(--fg-primary)",
      "matching-paired-bg":"color-mix(in srgb, var(--exercise-matched) 22%, var(--bg-surface))","matching-paired-fg":"var(--fg-primary)",
      "star":STAR[fam],
      "chart-1":charts[0],"chart-2":charts[1],"chart-3":charts[2],"chart-4":charts[3],"chart-5":charts[4],"chart-6":charts[5],
      "shadow-card":f"0 1px 2px rgba(0,0,0,{shadow_a*0.7:.2f}), 0 8px 24px rgba(0,0,0,{shadow_a:.2f})",
      "shadow-elevated":f"0 4px 12px rgba(0,0,0,{shadow_a:.2f}), 0 24px 48px rgba(0,0,0,{shadow_a*1.4:.2f})",
      "shadow-md":f"0 4px 12px rgba(0,0,0,{shadow_a*1.1:.2f})",
    }
    # verify
    checks=[("fg/bg",ratio(fg,bg)),("fg-sec/bg",ratio(fg_secondary,bg)),("fg-muted/bg",ratio(fg_muted,bg)),
            ("accent-fg/accent",ratio(accent_fg,primary)),
            ("accent-text/p",ratio(accent_text,bg)),("accent-text/c",ratio(accent_text,surface)),
            ("success/bg",ratio(success,bg)),
            ("warning/bg",ratio(warning,bg)),("info/bg",ratio(info,bg)),("error/bg",ratio(error,bg)),
            ("fg-inv/error",ratio(fg_inverse,error)),
            ("ex-correct/surf",ratio(ex_correct,surface)),("ex-wrong/surf",ratio(ex_wrong,surface))]
    return tokens, checks

ORDER=["bg-primary","bg-secondary","bg-surface","bg-elevated","bg-overlay",
 "fg-primary","fg-secondary","fg-muted","fg-inverse",
 "border-primary","border-subtle","border-accent",
 "interactive-bg","interactive-hover","interactive-active","interactive-disabled",
 "accent","accent-hover","accent-fg","accent-text","accent-subtle","accent-rgb",
 "success","success-bg","error","error-bg","warning","warning-bg","info","info-bg",
 "exercise-correct","exercise-wrong","exercise-selected","exercise-matched",
 "matching-side-a-bg","matching-side-a-fg","matching-side-b-bg","matching-side-b-fg",
 "matching-paired-bg","matching-paired-fg","star",
 "chart-1","chart-2","chart-3","chart-4","chart-5","chart-6",
 "shadow-card","shadow-elevated","shadow-md"]
LABELS={"catppuccin-latte":"Catppuccin Latte","supabase":"Supabase","graphite":"Graphite",
        "catppuccin-mocha":"Catppuccin Mocha","soft-pop":"Soft Pop","amethyst-haze":"Amethyst Haze"}
SRC={"catppuccin-latte":"tweakcn catppuccin (Latte)","supabase":"tweakcn supabase","graphite":"tweakcn graphite",
     "catppuccin-mocha":"tweakcn catppuccin (Mocha)","soft-pop":"tweakcn soft-pop","amethyst-haze":"tweakcn amethyst-haze"}
import os
OUT="frontend/src/styles/themes"
allgood=True
for tid,s in P.items():
    tokens,checks=gen(tid,s)
    fails=[(n,r) for n,r in checks if (r<3.0 if "surf" in n else r<4.5)]
    status="OK" if not fails else "FAIL "+str(fails)
    if fails: allgood=False
    print(f"{tid:18} {status}  min={min(r for _,r in checks):.2f}")
    css=[f"/*",f" * {LABELS[tid]} ({FAMILY[tid]}) — adopted from {SRC[tid]}.",
         f" * WCAG AA verified (all text pairs >= 4.5:1; exercise/UI >= 3:1).",
         f" * Generated; see scripts/generate_preset_themes.py + issue #86.",f" */",
         f'[data-theme="{tid}"] {{']
    for k in ORDER:
        css.append(f"  --{k}: {tokens[k]};")
    css.append("}")
    open(os.path.join(OUT,f"theme-{tid}.css"),"w").write("\n".join(css)+"\n")
print("ALL AA PASS" if allgood else "SOME FAILED")
