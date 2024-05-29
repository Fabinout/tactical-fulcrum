import { DROPS } from "../../data/drop"
import { ENEMY_TYPES } from "../../data/enemy-type"
import { Enemy } from "../../models/enemy"
import { IoEnemy } from "./io-enemy"

export class IoEnemyFromAttributes {
  static fromAttributes(value: Record<string, string | number | null>): Enemy {
    const result: Enemy = new Enemy()
    const enemyType = value[IoEnemy.ATTRIBUTE_TYPE]
    result.type = ENEMY_TYPES.find((it) => it.valueOf() === enemyType)
    if (result.type === undefined) {
      result.type = null
    }
    result.level = value[IoEnemy.ATTRIBUTE_LEVEL] as number
    result.name = value[IoEnemy.ATTRIBUTE_NAME] as string
    result.hp = value[IoEnemy.ATTRIBUTE_HP] as number
    result.atk = value[IoEnemy.ATTRIBUTE_ATK] as number
    result.def = value[IoEnemy.ATTRIBUTE_DEF] as number
    result.exp = value[IoEnemy.ATTRIBUTE_EXP] as number
    let drop: string = value[IoEnemy.ATTRIBUTE_DROP] as string
    if (drop === "") {
      drop = null
    }
    result.drop = DROPS.indexOf(drop) === -1 ? null : drop
    return result
  }
}