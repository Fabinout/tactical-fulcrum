import { Action, ActionType, KillEnemy, OpenDoor, PickItem, PickKey, PlayerMove } from "../../models/play/action"
import { Container, FederatedPointerEvent, Sprite, Text, Ticker } from "pixi.js"
import { EMPTY_TILE, EnemyTile, STARTING_POSITION_TILE, Tile, TileType } from "../../../common/models/tile"
import { AbstractMap } from "../../../common/front/tower/abstract-map"
import { Delta2D } from "../../models/tuples"
import { Game } from "../../game"
import { getTextColor } from "../../../common/front/color-scheme"
import { Keys } from "../../../common/front/keys"
import { ScreenTower } from "./screen-tower"
import SlTooltip from "@shoelace-style/shoelace/cdn/components/tooltip/tooltip.component"
import { SpritesToItem } from "../../../common/front/map/sprites-to-item"
import { TILES_IN_ROW } from "../../../common/data/constants"

const TILE_MOVE_TIME: number = 150

const TILE_GRAB_HIDE_BEGIN_PERCENT: number = 0.25
const TILE_GRAB_HIDE_END_PERCENT: number = 0.75

const TILE_SWITCH_HIDE_BEGIN_PERCENT: number = 0.25
const TILE_SWITCH_HIDE_MIDDLE_PERCENT: number = 0.5
const TILE_SWITCH_HIDE_END_PERCENT: number = 0.75

export class Map extends AbstractMap {
  private readonly game: Game
  private tiles: Container
  private playerSprite: null | Sprite
  private tickerFunction: null | ((ticker: Ticker) => void)
  private deltaBuffer: Delta2D[] = []
  private currentAction: Action | null = null
  private readonly sprites: Sprite | null[][]

  constructor(game: Game) {
    super()
    this.game = game
    this.game.eventManager.registerSchemeChange(() => this.schemeChanged())
    this.sprites = new Array(TILES_IN_ROW)
    for (let lineIndex = 0; lineIndex < TILES_IN_ROW; lineIndex++) {
      this.sprites[lineIndex] = new Array(TILES_IN_ROW).fill(null, 0, TILES_IN_ROW)
    }
  }

  async init(): Promise<any> {
    console.debug("Map", "init")
    this.background.on("pointermove", (e: FederatedPointerEvent) => this.pointerMove(e))
    document.addEventListener("keydown", (e: KeyboardEvent) => this.keyDown(e))
    return super.init()
  }

  repaint(): void {
    if (this.currentAction) {
      this.currentAction = null
      if (this.tickerFunction !== null) {
        this.app.ticker.remove(this.tickerFunction)
        this.tickerFunction = null
      }
      this.deltaBuffer.length = 0
    }
    if (this.tiles != null) {
      this.app.stage.removeChild(this.tiles)
      this.tiles.destroy()
      this.playerSprite = null
    }
    this.createTiles()
    this.app.stage.addChild(this.tiles)
  }

  protected afterRepositionCursor(): void {
    const playerTower = this.game.playerTower!
    const tileReachable = playerTower.reachableTiles[this.lastMouseTile.y][this.lastMouseTile.x]
    if (tileReachable === null) {
      this.app.canvas.style.cursor = "not-allowed"
    } else {
      this.app.canvas.style.cursor = "auto"
    }
  }

  private createTiles(): void {
    this.tiles = new Container()
    const playerTower = this.game.playerTower!
    const playerPosition = playerTower.playerPosition
    const currentRoomIndex = playerPosition.room
    const currentRoom = playerTower.standardRooms[currentRoomIndex]
    const scores = playerTower.tower.standardRooms[currentRoomIndex].scores
    for (let lineIndex = 0; lineIndex < TILES_IN_ROW; lineIndex++) {
      for (let columnIndex = 0; columnIndex < TILES_IN_ROW; columnIndex++) {
        const x = this.tileSize * columnIndex
        const y = this.tileSize * lineIndex

        const playerOnCurrentTile = lineIndex === playerPosition.line && columnIndex === playerPosition.column
        if (playerOnCurrentTile) {
          this.playerSprite = this.spriter.getSprite(SpritesToItem.spriteNameFromTile(STARTING_POSITION_TILE)!)
          this.playerSprite.x = x
          this.playerSprite.y = y
          this.tiles.addChild(this.playerSprite)
        }

        const currentTile = currentRoom[lineIndex][columnIndex]
        const currentScore = scores.find((s) => s.line === lineIndex && s.column === columnIndex)
        if (currentScore !== undefined) {
          const scoreSpriteName = SpritesToItem.spriteNameFromScore(currentScore.type)
          const scoreSprite = this.spriter.getSprite(scoreSpriteName)
          scoreSprite.x = x
          scoreSprite.y = y
          if (currentTile !== EMPTY_TILE || playerOnCurrentTile) {
            scoreSprite.alpha = 0.2
          }
          this.tiles.addChild(scoreSprite)
        }

        if (currentTile !== EMPTY_TILE) {
          const sprite = this.createSprite(currentTile!)
          sprite.x = x
          sprite.y = y
          if (playerOnCurrentTile) {
            sprite.alpha = 0.2
          }
          this.tiles.addChild(sprite)
          this.sprites[lineIndex][columnIndex] = sprite
        } else {
          this.sprites[lineIndex][columnIndex] = null
        }
      }
    }
  }

  private createSprite(tile: Tile): Container {
    const spriteName = SpritesToItem.spriteNameFromTile(tile)!
    const sprite = this.spriter.getSprite(spriteName)
    if (tile.getType() == TileType.enemy) {
      const enemyContainer = new Container()
      enemyContainer.addChild(sprite)
      const enemyTile = tile as EnemyTile
      const text = new Text({
        text: enemyTile.enemy.level !== null ? enemyTile.enemy.level : "",
        style: {
          fontFamily: "JetBrains Mono",
          fontSize: this.tileSize / 2,
          fill: getTextColor(),
          align: "center",
        },
      })
      text.x = this.tileSize * 0.5
      text.y = this.tileSize * 0.4
      text.anchor.x = 0.5
      enemyContainer.addChild(text)
      return enemyContainer
    } else {
      return sprite
    }
  }

  postInit(): void {
    console.debug("Map", "postInit")
    this.toolTip = document.getElementById(ScreenTower.TOOL_TIP_ID)!
    this.tooltipTip = document.getElementById(ScreenTower.TOOL_TIP_TIP_ID) as SlTooltip
  }

  protected showToolTip(): void {
    if (this.toolTipTimeout != null) {
      clearTimeout(this.toolTipTimeout)
    }
  }

  private keyDown(e: KeyboardEvent): void {
    console.debug("Map", "keyDown", e)
    switch (e.key) {
      case Keys.ARROW_RIGHT: {
        this.bufferDirection(Delta2D.RIGHT)
        break
      }
      case Keys.ARROW_LEFT: {
        this.bufferDirection(Delta2D.LEFT)
        break
      }
      case Keys.ARROW_UP: {
        this.bufferDirection(Delta2D.UP)
        break
      }
      case Keys.ARROW_DOWN: {
        this.bufferDirection(Delta2D.DOWN)
        break
      }
    }
  }

  private bufferDirection(delta: Delta2D): void {
    this.deltaBuffer.push(delta)
    if (this.currentAction === null) {
      this.tryAction()
    }
  }

  private triggerMoveAction(move: PlayerMove | PickItem | PickKey) {
    let totalPercentMove: number = 0
    const deltaColumn = move.target.column - move.player.column
    const deltaLine = move.target.line - move.player.line
    let targetSprite: null | Sprite = null
    if (move.getType() === ActionType.PICK_ITEM || move.getType() === ActionType.PICK_KEY) {
      targetSprite = this.sprites[move.target.line][move.target.column]
    }
    return (ticker: Ticker): void => {
      const percentMove: number = ticker.deltaMS / TILE_MOVE_TIME
      totalPercentMove += percentMove

      if (targetSprite !== null) {
        if (totalPercentMove >= TILE_GRAB_HIDE_END_PERCENT) {
          this.tiles.removeChild(targetSprite)
          targetSprite = null
        } else if (totalPercentMove > TILE_GRAB_HIDE_BEGIN_PERCENT) {
          targetSprite!.alpha =
            1 -
            (totalPercentMove - TILE_GRAB_HIDE_BEGIN_PERCENT) /
              (TILE_GRAB_HIDE_END_PERCENT - TILE_GRAB_HIDE_BEGIN_PERCENT)
        }
      }

      if (deltaColumn !== 0) {
        if (totalPercentMove >= 1) {
          this.playerSprite!.x = (move.player.column + deltaColumn) * this.tileSize
          this.currentMoveEnded()
        } else {
          this.playerSprite!.x += percentMove * deltaColumn * this.tileSize
        }
      }
      if (deltaLine !== 0) {
        if (totalPercentMove >= 1) {
          this.playerSprite!.y = (move.player.line + deltaLine) * this.tileSize
          this.currentMoveEnded()
        } else {
          this.playerSprite!.y += percentMove * deltaLine * this.tileSize
        }
      }
    }
  }

  private triggerMoveAndBackAction(move: OpenDoor | KillEnemy) {
    let totalPercentMove: number = 0
    const deltaColumn = move.target.column - move.player.column
    const deltaLine = move.target.line - move.player.line
    const oldTargetSprite: Sprite = this.sprites[move.target.line][move.target.column]

    const hasNewTile = move.getType() == ActionType.KILL_ENEMY && (move as KillEnemy).dropTile != EMPTY_TILE
    let newTargetSprite: null | Sprite = null
    if (hasNewTile) {
      newTargetSprite = this.spriter.getSprite(SpritesToItem.spriteNameFromTile((move as KillEnemy).dropTile)!)
      newTargetSprite.alpha = 0
      newTargetSprite.x = oldTargetSprite.x
      newTargetSprite.y = oldTargetSprite.y
      this.sprites[move.target.line][move.target.column] = newTargetSprite
    }
    let switchDone = false
    return (ticker: Ticker): void => {
      const percentMove: number = ticker.deltaMS / TILE_MOVE_TIME
      totalPercentMove += percentMove

      if (totalPercentMove >= TILE_SWITCH_HIDE_END_PERCENT) {
        if (newTargetSprite !== null) {
          newTargetSprite.alpha = 1
          newTargetSprite = null
        }
      } else if (totalPercentMove > TILE_SWITCH_HIDE_MIDDLE_PERCENT) {
        if (!switchDone) {
          switchDone = true
          oldTargetSprite!.alpha = 0
          this.tiles.removeChild(oldTargetSprite)
          if (newTargetSprite !== null) {
            this.tiles.addChild(newTargetSprite)
          }
        } else {
          if (newTargetSprite !== null) {
            newTargetSprite!.alpha =
              1 -
              (totalPercentMove - TILE_SWITCH_HIDE_BEGIN_PERCENT) /
                (TILE_SWITCH_HIDE_MIDDLE_PERCENT - TILE_SWITCH_HIDE_BEGIN_PERCENT)
          }
        }
      } else if (totalPercentMove > TILE_SWITCH_HIDE_BEGIN_PERCENT) {
        oldTargetSprite!.alpha =
          1 -
          (totalPercentMove - TILE_SWITCH_HIDE_BEGIN_PERCENT) /
            (TILE_SWITCH_HIDE_MIDDLE_PERCENT - TILE_SWITCH_HIDE_BEGIN_PERCENT)
      }

      if (deltaColumn !== 0) {
        if (totalPercentMove >= 1) {
          this.playerSprite!.x = move.player.column * this.tileSize
          this.currentMoveEnded()
        } else if (totalPercentMove >= 0.5) {
          this.playerSprite!.x -= (percentMove * deltaColumn * this.tileSize) / 4
        } else {
          this.playerSprite!.x += (percentMove * deltaColumn * this.tileSize) / 4
        }
      }
      if (deltaLine !== 0) {
        if (totalPercentMove >= 1) {
          this.playerSprite!.x = move.player.column * this.tileSize
          this.currentMoveEnded()
        } else if (totalPercentMove >= 0.5) {
          this.playerSprite!.y -= (percentMove * deltaLine * this.tileSize) / 4
        } else {
          this.playerSprite!.y += (percentMove * deltaLine * this.tileSize) / 4
        }
      }
    }
  }

  private tryAction(): void {
    const delta = this.deltaBuffer.shift()!
    const action: Action | null = this.game.playerTower!.movePlayer(delta)
    console.debug("Map", "tryAction", delta, action === null ? null : action.getType())
    if (action === null) {
      this.deltaBuffer.length = 0
      this.currentAction = null
      return
    }
    this.currentAction = action
    switch (action.getType()) {
      case ActionType.MOVE:
        this.tickerFunction = this.triggerMoveAction(action as PlayerMove)
        break
      case ActionType.PICK_ITEM:
        this.tickerFunction = this.triggerMoveAction(action as PickItem)
        break
      case ActionType.PICK_KEY:
        this.tickerFunction = this.triggerMoveAction(action as PickKey)
        break
      case ActionType.OPEN_DOOR:
        this.tickerFunction = this.triggerMoveAndBackAction(action as OpenDoor)
        break
      case ActionType.KILL_ENEMY:
        this.tickerFunction = this.triggerMoveAndBackAction(action as KillEnemy)
        break
    }
    this.app.ticker.add(this.tickerFunction!)
  }

  private currentMoveEnded(): void {
    console.debug("Map", "maybeStopAction")
    if (this.tickerFunction !== null) {
      this.app.ticker.remove(this.tickerFunction)
      this.tickerFunction = null
    }
    if (this.deltaBuffer.length == 0) {
      console.debug("Map", "maybeStopAction", "stop")
      this.currentAction = null
    } else {
      console.debug("Map", "maybeStopAction", "go on")
      this.tryAction()
    }
  }
}
