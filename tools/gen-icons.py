"""Génère les icônes PWA (hub, transport, agro, livreur). Usage : python3 tools/gen-icons.py [client]  (client : icônes dans clients/<client>/icons)"""
from PIL import Image, ImageDraw, ImageFont
import os
import sys
CLIENT=sys.argv[1] if len(sys.argv)>1 else ""
OUT=os.path.join(os.path.dirname(__file__),"..","clients",CLIENT,"icons") if CLIENT else os.path.join(os.path.dirname(__file__),"..","icons")
os.makedirs(OUT,exist_ok=True)
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
APPS={"hub":("AG",(11,59,76),(14,116,144)),"transport":("T",(124,45,18),(194,65,12)),"agro":("A",(26,71,49),(45,106,79)),"livreur":("L",(8,58,70),(8,145,178)),"centre":("C",(6,78,59),(5,150,105))}
def grad(size,c1,c2):
    im=Image.new("RGB",(size,size));px=im.load()
    for y in range(size):
        t=y/(size-1);col=tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3))
        for x in range(size):px[x,y]=col
    return im
def icon(app,size,maskable=False,apple=False):
    txt,c1,c2=APPS[app];S=size*4;bg=grad(S,c1,c2)
    d=ImageDraw.Draw(bg);safe=0.62 if maskable else 0.74
    f=ImageFont.truetype(FONT,int(S*safe*(0.62 if len(txt)>1 else 0.86)))
    bb=d.textbbox((0,0),txt,font=f);w,h=bb[2]-bb[0],bb[3]-bb[1]
    x=(S-w)/2-bb[0];y=(S-h)/2-bb[1]-S*0.03
    d.text((x,y),txt,font=f,fill=(255,255,255))
    bw=int(w*0.7);by=int(y+bb[3]+S*0.035);d.rounded_rectangle([(S-bw)//2,by,(S+bw)//2,by+int(S*0.022)],radius=int(S*0.011),fill=(255,255,255,200))
    img=bg
    if not maskable and not apple:  # coins arrondis (icône « any »)
        m=Image.new("L",(S,S),0);ImageDraw.Draw(m).rounded_rectangle([0,0,S-1,S-1],radius=int(S*0.22),fill=255)
        out=Image.new("RGBA",(S,S),(0,0,0,0));out.paste(img,(0,0),m);img=out
    return img.resize((size,size),Image.LANCZOS)
if CLIENT=="logistica":
    R1,R2=(122,29,23),(200,53,43)
    APPS={"hub":("LG",R1,R2),"livreur":("L",R1,R2),"vendeur":("V",R1,R2),"placement":("P",(124,70,0),(214,134,16)),"assurance":("A",(20,62,92),(30,110,160))}
ONLY=os.environ.get("ONLY")   # ex. ONLY=centre : ne régénère que cette application
for app in APPS:
    if ONLY and app!=ONLY:continue
    icon(app,192).save(f"{OUT}/{app}-192.png",optimize=True)
    icon(app,512).save(f"{OUT}/{app}-512.png",optimize=True)
    icon(app,512,maskable=True).save(f"{OUT}/{app}-maskable-512.png",optimize=True)
    icon(app,180,apple=True).convert("RGB").save(f"{OUT}/{app}-apple-180.png",optimize=True)
print("icônes générées")
if CLIENT:
    import shutil
    shutil.copy(f"{OUT}/hub-192.png",f"{OUT}/icon-192.png");shutil.copy(f"{OUT}/hub-512.png",f"{OUT}/icon-512.png");shutil.copy(f"{OUT}/hub-maskable-512.png",f"{OUT}/icon-maskable-512.png");shutil.copy(f"{OUT}/hub-apple-180.png",f"{OUT}/apple-touch-icon.png")
