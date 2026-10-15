"""Génère les icônes PWA (hub, transport, agro). Usage : python3 tools/gen-icons.py"""
from PIL import Image, ImageDraw, ImageFont
import os
OUT=os.path.join(os.path.dirname(__file__),"..","icons")
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
APPS={"hub":("AG",(11,59,76),(14,116,144)),"transport":("T",(124,45,18),(194,65,12)),"agro":("A",(26,71,49),(45,106,79))}
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
for app in APPS:
    icon(app,192).save(f"{OUT}/{app}-192.png",optimize=True)
    icon(app,512).save(f"{OUT}/{app}-512.png",optimize=True)
    icon(app,512,maskable=True).save(f"{OUT}/{app}-maskable-512.png",optimize=True)
    icon(app,180,apple=True).convert("RGB").save(f"{OUT}/{app}-apple-180.png",optimize=True)
print("icônes générées")
