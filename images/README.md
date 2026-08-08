# images

Optional. Everything on the site is drawn as pixel-art SVG from `js/sprites.js`, so this folder
starts empty.

Put a picture in here if you would rather use a real image for a guest, then point that guest at it
in `js/content.js`:

```js
{
  name: 'TYSON FURY',
  sprite: 'boxer',
  image: 'images/tyson.png',   // used instead of the sprite
  ...
}
```

Pixel-art style suits the rest of the site. Keep files small — every visitor downloads them.
