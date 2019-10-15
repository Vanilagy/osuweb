// The definition of "basic" is kind of ambiguous here, but I don't know how else to call it.
export function transferBasicProperties(source: PIXI.Container, target: PIXI.Container) {
    target.position.copyFrom(source.position);
    target.rotation = source.rotation;
    target.scale.copyFrom(source.scale);
    target.pivot.copyFrom(source.pivot);
}

export function transferBasicSpriteProperties(source: PIXI.Sprite, target: PIXI.Sprite) {
    target.texture = source.texture;
    target.width = source.width;
    target.height = source.height;
    target.anchor.copyFrom(source.anchor);
}