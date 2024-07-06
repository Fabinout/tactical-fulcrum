import { DropContentItem, DropContentKey, DROPS_CONTENTS, DropType } from "../../../common/data/drop"
import { EMPTY_TILE, ItemTile, KeyTile, StaircaseTile, Tile, TileType } from "../../../common/models/tile"
import { Enemy } from "../../../common/models/enemy"
import { Position3D } from "../tuples"
import { StaircaseDirection } from "../../../common/data/staircase-direction"
import { TILES_IN_ROW } from "../../../common/data/constants"

export function findStartingPosition(rooms: Tile[][][]): Position3D {
  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex++) {
    const room = rooms[roomIndex]
    for (let lineIndex = 0; lineIndex < TILES_IN_ROW; lineIndex++) {
      const line = room[lineIndex]
      for (let columnIndex = 0; columnIndex < TILES_IN_ROW; columnIndex++) {
        if (line[columnIndex].getType() === TileType.startingPosition) {
          line[columnIndex] = EMPTY_TILE
          return new Position3D(roomIndex, lineIndex, columnIndex)
        }
      }
    }
  }
  throw new Error("No starting position found")
}

export function findStaircasePosition(
  rooms: Tile[][][],
  roomIndex: number,
  staircaseDirection: StaircaseDirection,
): Position3D {
  const room = rooms[roomIndex]
  for (let lineIndex = 0; lineIndex < TILES_IN_ROW; lineIndex++) {
    const line = room[lineIndex]
    for (let columnIndex = 0; columnIndex < TILES_IN_ROW; columnIndex++) {
      const currentTile = line[columnIndex]
      if (currentTile.getType() === TileType.staircase) {
        const staircase = currentTile as StaircaseTile
        if (staircase.direction === staircaseDirection) {
          return new Position3D(roomIndex, lineIndex, columnIndex)
        }
      }
    }
  }
  throw new Error("No stair position found")
}

export function getDropTile(enemy: Enemy): Tile {
  const dropName = enemy.drop
  if (dropName == null) {
    return EMPTY_TILE
  }
  const dropContent = DROPS_CONTENTS.get(dropName)
  if (dropContent === undefined) {
    throw new Error(`Unknown drop [${dropName}]`)
  }
  switch (dropContent.getType()) {
    case DropType.KEY:
      return new KeyTile((dropContent as DropContentKey).color)
    case DropType.ITEM:
      return new ItemTile((dropContent as DropContentItem).itemName)
  }
}
