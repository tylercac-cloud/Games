# Crypta's pixel sprite (original character). 24x24, one letter per pixel.
PAL={'K':'#1b1530','H':'#2b3a67','h':'#4a67b8','S':'#f4cdb0','s':'#dca386','E':'#6b3fa0','e':'#b48ae0','W':'#ffffff',
     'M':'#b0566b','B':'#f3a3a3','T':'#1f8a8a','t':'#15696b','G':'#f0c040','g':'#b8871c','C':'#e9f6f6'}
ROWS=[
"........................",
"........KKKKKKKK........",
"......KKHHHHHHHHKK......",
".....KHHHhhhHHHHHHK.....",
"....KHHhhHHHHHHHHGGK....",
"....KHhHHHHHHHHHHGgGK...",
"...KHHHHHHHHHHHHHHGgK...",
"...KHHHHSSSSSSSSHHHGK...",
"...KHHHSSSSSSSSSSHHHK...",
"...KHHSSSSSSSSSSSSHHK...",
"...KHHSKKKSSSSKKKSHHK...",
"...KHHSWEeSSSSWEeSHHK...",
"...KHHSWEESSSSWEESHHK...",
"...KHHSSSSSSSSSSSSHHK...",
"...KHHSBBSSSSSSBBSHHK...",
"...KHHHSSSSMMSSSSHHHK...",
"...KHHHHSSSSSSSSHHHHK...",
"....KHHHKsSSSSsKHHHK....",
".....KKKTKSSSSKTKKK.....",
"....KTTTTTKKKKTTTTTK....",
"...KTTTTTTTCCTTTTTTTK...",
"..KTTtTTTTTGGTTTTTtTTK..",
"..KTTtTTTTTggTTTTTtTTK..",
"..KKKKKKKKKKKKKKKKKKKK..",
]
assert len(ROWS)==24 and all(len(r)==24 for r in ROWS),[len(r) for r in ROWS]
def svg(size=96):
    rects=''.join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{PAL[c]}"/>' for y,r in enumerate(ROWS) for x,c in enumerate(r) if c!='.')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{size}" height="{size}" shape-rendering="crispEdges">{rects}</svg>'
def png(path,size,bg=None):
    from PIL import Image
    im=Image.new('RGBA',(24,24),(0,0,0,0) if bg is None else bg)
    for y,r in enumerate(ROWS):
        for x,c in enumerate(r):
            if c!='.':im.putpixel((x,y),tuple(int(PAL[c][i:i+2],16) for i in (1,3,5))+(255,))
    pad=Image.new('RGBA',(28,28),(0,0,0,0) if bg is None else bg);pad.paste(im,(2,2),im)
    pad.resize((size,size),Image.NEAREST).save(path)
if __name__=='__main__':
    import sys
    png('/tmp/crypta_preview.png',336,(245,240,230,255))
    open('/tmp/crypta.svg','w').write(svg())
    print('ok')
