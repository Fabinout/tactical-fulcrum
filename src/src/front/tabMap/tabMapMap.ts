import {Application, Container, FederatedPointerEvent, Graphics, Point, Sprite} from 'pixi.js'
import {TILES_DEFAULT_SIZE, TILES_IN_ROW} from '../../data/map'
import {Sprites, TacticalFulcrumSprites} from './sprites'
import {Editor} from '../../../editor'
import {EVENT_ROOM_SELECT_NO_ROOM_SELECTED} from '../eventManager'
import {DoorTile, EnemyTile, ItemTile, KeyTile, StaircaseTile, Tile, TileType} from '../../behavior/tile'
import {StaircaseDirection} from '../../data/staircaseDirection'
import {SlTooltip} from '@shoelace-style/shoelace'
import {Color} from "../../data/color";

export class TabMapMap {
    readonly app: Application
    private readonly background: Sprite
    private readonly cursor: Graphics
    private tileSize: number = TILES_DEFAULT_SIZE
    private readonly lastMousePosition: Point = new Point()
    private lastMouseTile: Point = new Point(-1, -1)
    private sprites: Sprites = new Sprites()
    private readonly editor: Editor
    private selectedRoomIndex: number = EVENT_ROOM_SELECT_NO_ROOM_SELECTED
    private tiles: Container
    private mapToolTip: HTMLElement
    private toolTipTimeout: number = null
    private mapToolTipTip: SlTooltip

    constructor(editor: Editor) {
        this.app = new Application()
        this.background = new Sprite()
        this.background.eventMode = 'dynamic'
        this.cursor = new Graphics().rect(0, 0, this.tileSize, this.tileSize).stroke({width: 1, color: 0xff0000})
        this.cursor.eventMode = 'none'
        this.editor = editor
        this.editor.eventManager.registerRoomChange(selectedRoomIndex => this.roomSelected(selectedRoomIndex))
    }

    async init(): Promise<any> {
        console.debug('TabMapMap', 'init')
        this.background.on('pointerenter', () => this.pointerEnter())
        this.background.on('pointerleave', () => this.pointerLeave())
        this.background.on('pointermove', (e: FederatedPointerEvent) => this.pointerMove(e))
        return Promise.all([
            this.app.init({background: '#FDFDFD'}),
            this.sprites.reload(this.tileSize),
        ]).then(() => {
            this.app.stage.addChild(this.background)
            this.app.stage.addChild(this.cursor)
            this.repaint()
        })
    }

    postInit(): void {
        console.debug('TabMapMap', 'postInit')
        this.mapToolTip = document.getElementById('tabMapMapToolTip')
        this.mapToolTipTip = document.getElementById('tabMapMapToolTipTip') as SlTooltip
    }

    resize(elementSize: number): void {
        console.debug('TabMapMap', 'resize')
        const newTileSize = Math.floor(elementSize / TILES_IN_ROW)
        if (newTileSize != this.tileSize) {
            this.tileSize = newTileSize
            const appSize = this.tileSize * TILES_IN_ROW
            this.app.renderer.resize(appSize, appSize)
            this.background.width = appSize
            this.background.height = appSize
            this.cursor.scale = this.tileSize / TILES_DEFAULT_SIZE
            this.sprites = new Sprites()
            this.sprites.reload(this.tileSize).then(() => {
                this.repaint()
            })
            this.mapToolTip.style.width = `${newTileSize}px`
        }
    }

    private pointerMove(e: FederatedPointerEvent): void {
        e.getLocalPosition(this.app.stage, this.lastMousePosition)
        const x: number = this.lastMousePosition.x
        const y: number = this.lastMousePosition.y
        const tileX: number = Math.floor(x / this.tileSize)
        const tileY: number = Math.floor(y / this.tileSize)
        const newMouseTile: Point = new Point(tileX, tileY)
        if (!this.lastMouseTile.equals(newMouseTile)) {
            console.debug('TabMapMap', 'moved tile', 'tileY', tileY, 'tileX', tileX)
            this.lastMouseTile = newMouseTile
            if (this.mapToolTipTip.open) {
                this.mapToolTipTip.open = false
            }
            this.repositionCursor()
            if (this.toolTipTimeout != null) {
                clearTimeout(this.toolTipTimeout)
            }
            this.toolTipTimeout = setTimeout(() => {
                this.showToolTip()
            }, 200)
        }
    }

    private showToolTip(): void {
        if (this.toolTipTimeout != null) {
            clearTimeout(this.toolTipTimeout)
        }
        if (this.selectedRoomIndex != EVENT_ROOM_SELECT_NO_ROOM_SELECTED) {
            const currentRoom = this.editor.tower.rooms[this.selectedRoomIndex]
            const currentTile: Tile = currentRoom.tiles[this.lastMouseTile.y][this.lastMouseTile.x]
            const toolTipText = this.getToolTipText(currentTile)
            if (toolTipText != null) {
                this.mapToolTipTip.content = toolTipText
                const cursorPosition = this.cursor.getGlobalPosition()
                const top = this.app.canvas.offsetTop + cursorPosition.y
                const left = this.app.canvas.offsetLeft + cursorPosition.x
                this.mapToolTip.style.top = `${top}px`
                this.mapToolTip.style.left = `${left}px`
                this.mapToolTipTip.open = true
            }
        }
    }

    private pointerEnter(): void {
        this.cursor.visible = true
    }

    private pointerLeave(): void {
        this.cursor.visible = false
    }

    private repositionCursor(): void {
        this.cursor.x = this.lastMouseTile.x * this.tileSize
        this.cursor.y = this.lastMouseTile.y * this.tileSize
    }

    private roomSelected(selectedRoomIndex: number): void {
        console.debug('TabMapMap', 'roomSelected', selectedRoomIndex)
        this.selectedRoomIndex = selectedRoomIndex
        this.repaint()
    }

    private repaint(): void {
        if (this.tiles != null) {
            this.app.stage.removeChild(this.tiles)
            this.tiles.destroy()
        }
        this.tiles = new Container()
        if (this.selectedRoomIndex != EVENT_ROOM_SELECT_NO_ROOM_SELECTED) {
            const currentRoom = this.editor.tower.rooms[this.selectedRoomIndex]
            for (let lineIndex = 0; lineIndex < TILES_IN_ROW; lineIndex++) {
                for (let columnIndex = 0; columnIndex < TILES_IN_ROW; columnIndex++) {
                    const currentTile = currentRoom.tiles[lineIndex][columnIndex]
                    const sheetName = this.sheetNameFromTile(currentTile)
                    if (sheetName != null) {
                        const sprite = this.sprites.getSprite(sheetName)
                        sprite.x = this.tileSize * columnIndex
                        sprite.y = this.tileSize * lineIndex
                        this.tiles.addChild(sprite)
                    }
                }
            }
        }
        this.app.stage.addChild(this.tiles)
    }

    private getToolTipText(tile: Tile): string | null {
        switch (tile.getType()) {
            case TileType.enemy:
                const enemy = (tile as EnemyTile).enemy
                return `${(enemy.type === null) || (enemy.type.length === 0) ? '??' : enemy.type} ${(enemy.level === null) ? '??' : enemy.level} (${enemy.name})`
            case TileType.item:
                return (tile as ItemTile).item.valueOf()
        }
        return null
    }

    private sheetNameFromTile(tile: Tile): TacticalFulcrumSprites | null {
        switch (tile.getType()) {
            case TileType.empty:
                return null
            case TileType.door:
                switch((tile as DoorTile).color) {
                    case Color.blue:
                        return TacticalFulcrumSprites.doorBlue
                    case Color.crimson:
                        return TacticalFulcrumSprites.doorCrimson;
                    case Color.greenBlue:
                        return TacticalFulcrumSprites.doorGreenBlue
                    case Color.platinum:
                        return TacticalFulcrumSprites.doorPlatinum
                    case Color.violet:
                        return TacticalFulcrumSprites.doorViolet
                    case Color.yellow:
                        return TacticalFulcrumSprites.doorYellow
                }
                break
            case TileType.key:
                switch((tile as KeyTile).color) {
                    case Color.blue:
                        return TacticalFulcrumSprites.keyBlue
                    case Color.crimson:
                        return TacticalFulcrumSprites.keyCrimson;
                    case Color.greenBlue:
                        return TacticalFulcrumSprites.keyGreenBlue
                    case Color.platinum:
                        return TacticalFulcrumSprites.keyPlatinum
                    case Color.violet:
                        return TacticalFulcrumSprites.keyViolet
                    case Color.yellow:
                        return TacticalFulcrumSprites.keyYellow
                }
                break
            case TileType.enemy:
                return TacticalFulcrumSprites.enemy
            case TileType.item:
                return TacticalFulcrumSprites.item
            case TileType.staircase:
                switch ((tile as StaircaseTile).direction) {
                    case StaircaseDirection.down:
                        return TacticalFulcrumSprites.staircaseUp
                    case StaircaseDirection.up:
                        return TacticalFulcrumSprites.staircaseDown
                }
                break
            case TileType.startingPosition:
                return TacticalFulcrumSprites.startingPosition
            case TileType.wall:
                return TacticalFulcrumSprites.wall
        }
        console.error('TabMapMap', 'sheetNameFromTile', 'Unknown tile', tile.getType())
        return null
    }
}
