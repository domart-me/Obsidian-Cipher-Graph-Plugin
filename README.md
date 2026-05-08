# Cipher Graph View

Futuristische 3D-Neon-Graph-Ansicht für Obsidian. Cyberpunk fürs zweite Gehirn. 🌌

## Features

- Eigene Obsidian View: **Cipher Graph**
- 3D Force Graph für alle Markdown-Notes im Vault
- Neon Nodes nach Ordner/Cluster-Farbe
- Grüne, größere Glow-Nodes für kürzlich bearbeitete Notes
- Partikel auf Links
- Such-/Fokusmodus
- Klick auf Node öffnet die Note
- Refresh- und Reset-Button

## Entwicklung

```bash
cd cipher-graph-view
npm install
npm run build
```

Für Watch-Modus:

```bash
npm run dev
```

## Installation in Obsidian

### Variante A: Manuell kopieren

1. In Obsidian deinen Vault öffnen.
2. Plugin-Ordner im Vault anlegen:

```bash
mkdir -p /pfad/zu/deinem/vault/.obsidian/plugins/cipher-graph-view
```

3. Diese Dateien aus dem Projektordner dorthin kopieren:

```bash
cp manifest.json main.js styles.css /pfad/zu/deinem/vault/.obsidian/plugins/cipher-graph-view/
```

4. Obsidian öffnen → **Settings → Community plugins**.
5. Falls nötig: **Restricted mode** ausschalten.
6. **Installed plugins** → Reload/Refresh drücken.
7. **Cipher Graph View** aktivieren.
8. Links in der Ribbon-Leiste auf das Netzwerk-Icon klicken oder Command Palette öffnen und suchen nach:
   `Open Cipher Graph View`

### Variante B: Symlink für Entwicklung

Praktisch, wenn du am Plugin weiterbaust:

```bash
ln -s /home/dominic/.openclaw/workspace/cipher-graph-view /pfad/zu/deinem/vault/.obsidian/plugins/cipher-graph-view
cd /home/dominic/.openclaw/workspace/cipher-graph-view
npm run dev
```

Danach in Obsidian Plugin reloaden.

## Dateien für Release

Für eine lokale Installation braucht Obsidian nur:

- `manifest.json`
- `main.js`
- `styles.css`

## Bedienung

- **Node klicken:** öffnet die Note
- **Suche:** fokussiert passende Notes und ihre direkten Links
- **Reset View:** zoomt wieder auf den ganzen Graph
- **Refresh:** baut den Graph aus dem aktuellen Vault neu

## Roadmap / geile nächste Ausbaustufen

- Einstellungsseite für Farben, Glow und Partikel
- Filter nach Ordnern, Tags und Dateinamen
- Tag-Nodes als eigene Hubs
- Timeline-Modus: Notes nach Änderungsdatum als „Memory Stream“
- Bloom/Postprocessing für noch mehr Hologramm-Vibe
- Local Graph Modus für die aktuell geöffnete Note

## Hinweis

Das Plugin nutzt `3d-force-graph`, `three` und `three-spritetext` und ist aktuell Desktop-only.
