# Text Colors — extension SillyTavern

Change la **couleur des textes** du chat (jamais les fonds, les bulles ou la mise en page), avec priorité sur les thèmes CSS personnalisés (par ex. un thème « iMessage Dark ») et sur d'autres extensions de couleurs de bulles.

Pensée pour **SillyTavern sur iPhone (Safari)** : interface en français, réglages tactiles, aucun `transform` sur les conteneurs du chat, `#form_sheld` n'est jamais touché.

## Installation

1. Dans SillyTavern, ouvrez le menu **Extensions** (icône des blocs) puis **Install extension** (Installer une extension).
2. Collez l'URL du dépôt :

   ```
   https://github.com/hydravnss/text-colors
   ```

3. Validez avec **Install just for me** (ou pour tous les utilisateurs), puis rechargez la page si SillyTavern le demande.
4. Ouvrez de nouveau **Extensions** : le tiroir **Text Colors** apparaît dans la liste des réglages.

Mise à jour : l'extension est déclarée `auto_update` ; vous pouvez aussi utiliser le bouton de mise à jour dans **Extensions > Manage extensions**.

Version minimale de SillyTavern : 1.12.0.

## Ce que l'on peut colorer

Chaque couleur dispose d'un **sélecteur de couleur**, d'un champ **hexadécimal** (`#rrggbb` ou `#rgb`), d'un curseur **d'opacité (alpha)** et d'un bouton **« Hérité du thème »** qui annule la couleur (la couleur de votre thème reprend la main).

| Emplacement | Cible |
| --- | --- |
| Texte normal – bots | texte des messages des personnages |
| Texte normal – Vous | texte de vos messages |
| Dialogues | ce qui est entre « … », "…" ou “…” |
| Actions / italique | `*…*` (balises `em` / `i`) |
| Gras | `**…**` (`strong` / `b`) |
| Citations | `blockquote` (`> citation`) |
| Code | `code` et blocs de code |
| Liens | `a` |
| Noms des personnages | `.ch_name .name_text` |
| Horodatage | `.timestamp` |
| Barre de saisie | texte tapé (`#send_textarea`) et placeholder |

Pour les couleurs des messages (dialogues, italique, gras, citations, code, liens), cochez **« Couleur distincte pour Vous »** si vous voulez une teinte différente dans vos bulles et dans celles des bots (utile quand votre bulle est bleue et celle des bots grise).

### Par personnage et par persona

La section **Par personnage / par persona** permet de fixer la couleur du **texte** et des **dialogues** d'un personnage précis (très pratique dans un **chat de groupe**) ou d'une **persona**. Choisissez un nom dans la liste (personnages du chat en cours + persona active) ou saisissez un nom exact. Ces surcharges sont prioritaires sur les couleurs globales.

## Détection des dialogues

SillyTavern enveloppe lui-même les guillemets dans une balise `<q>` (cela reçoit aussi la couleur « Dialogues »). Par sécurité, l'extension ajoute un **post-traitement du DOM** très léger qui enveloppe les dialogues restants dans `<span class="tc-quote">` :

- uniquement dans les nœuds texte de `.mes_text` ; le **code**, les **liens** et les balises déjà posées sont ignorés ;
- gère `"…"`, `« … »`, `“ ”` et les dialogues qui traversent un `*italique*` ou un `**gras**` ;
- **ne modifie jamais** le texte du message ni les données du chat (DOM uniquement, rien n'est enregistré) ;
- idempotent et compatible avec les balayages (swipes), l'édition (le mode édition n'est pas touché), le streaming (un guillemet non fermé n'est jamais coloré) ;
- peut être **désactivé** avec « Détecter les dialogues ».

## Effets facultatifs

- **Dégradé de texte** sur les dialogues (`background-clip: text`, deux couleurs et un angle) ;
- **Lueur** (glow) sur les dialogues.

Ces effets ne touchent que le texte, jamais le fond de la bulle.

## Préréglages (un tap)

Classique iMessage, Néon, Pastel, Romantique, Vampire, Or / Noir, Océan, Forêt, Monochrome, Daltonien-friendly (palette Okabe-Ito), Contraste élevé, Coucher de soleil. Un préréglage remplace les couleurs et les effets ; vos surcharges par personnage sont conservées. Un **aperçu en direct** en haut du panneau reflète immédiatement vos choix.

## Aide au contraste

Le contraste (norme WCAG) est calculé avec la **couleur réelle de vos bulles**, lue dans le chat (la valeur calculée de `background-color`, ou la moyenne d'un dégradé) — sans jamais la modifier. Sous chaque couleur, un message indique le ratio et affiche **⚠ Contraste faible** quand il est sous le seuil (3:1, 4.5:1 ou 7:1). L'option **« Ajuster automatiquement »** éclaircit ou assombrit uniquement le rendu pour atteindre le seuil, sans changer vos réglages enregistrés.

## Import / export

Section **Import / export** : **Exporter** remplit la zone de texte avec un JSON (copié dans le presse-papiers quand Safari l'autorise, et téléchargé en `text-colors.json`). Pour **importer**, collez un JSON dans la zone (ou chargez un fichier `.json`) puis touchez **Importer**. Les valeurs sont validées avant d'être appliquées.

Les réglages sont enregistrés dans `extension_settings.text_colors` (donc sauvegardés avec vos réglages SillyTavern).

## Compatibilité avec les thèmes et les autres extensions

- Les règles sont injectées dans `<style id="tc-style">`, replacé en **dernier élément de `<head>`** quand un autre style s'ajoute après lui, avec `!important` et une **spécificité volontairement très élevée** (`html body #chat .mes.mes.mes[is_user="…"]:not(…) .mes_text …`). Elles l'emportent donc sur un thème CSS personnalisé, y compris celui qui colore `em` / `i` en gris avec `!important`.
- Avec une autre extension qui se replace elle-même en dernier (par ex. **Bubble Colors**), les deux « gardiens » ne peuvent pas être tous les deux derniers : Text Colors détecte ce cas, cesse de se battre (pas de boucle, pas de recalculs de style en continu) et gagne quand même grâce à sa spécificité.
- Aucun fond, `border-radius`, marge, position ou `transform` n'est modifié. `#form_sheld` n'est jamais touché.

## Dépannage

- *Une couleur ne change pas* : vérifiez que l'extension est activée en haut du panneau et que la ligne n'affiche pas « Couleur du thème (inchangée) ». Dans un chat de groupe, une surcharge par personnage prime sur la couleur globale.
- *Texte illisible* : regardez les avertissements ⚠ sous les couleurs, ou activez l'ajustement automatique du contraste.
- *Tout réinitialiser* : bouton en bas du panneau.

## Licence

MIT — voir [LICENSE](LICENSE).
