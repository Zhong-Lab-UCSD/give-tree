/**
 * @license
 * Copyright 2017-2019 The Regents of the University of California.
 * All Rights Reserved.
 *
 * Created by Xiaoyi Cao
 * Department of Bioengineering
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @typedef {import('./giveTreeNode')} GiveTreeNode
 *
 * Withering nodes.
 *
 * These nodes have a property called `_lastUpdateGen` to show their last
 *    updated generation number. When `.wither()` is called, the age will
 *    be calculated by `this.tree._currGen` and then compared with
 *    `this.tree.lifeSpan`. If the node is older than expected, then the
 *    content of the node will be purged with `null` with `.clear(null)`.
 *
 * The node is also responsible for withering of all its children. For any
 *    child that returns `true` for its `.wither()` call, call
 *    `.remove(child, true)` to remove them.
 *
 * @param {GiveTreeNode} Base
 * @mixin WitheringMixin
 */
const WitheringMixin = Base => class extends Base {
  /**
   * @constructor
   * @param {Object} [props] - properties that will be passed to the individual
   *    implementations
   * @param {number} [props._currGen] - the current generation
   */
  constructor (props) {
    super(...arguments)
    if ((props && props._currGen) || (this.tree && this.tree.lifeSpan)) {
      /**
       * @property {number} \_lastUpdateGen - Last updated generation of this
       *    node. This value will be updated whenever `.insert()` or
       *    `.traverse()` is called so that active branches won't wither easily.
       *    Because of this, the `_lastUpdateGen` for parents should always be
       *    no earlier than their children (see `this.wither()` for a potential
       *    exception and the solution for that).
       * @type {number}
       */
      this._lastUpdateGen = props._currGen || this.tree._currGen
    }
  }

  mergeAfter (node) {
    let nodeGen = node
      ? (node._lastUpdateGen || this._lastUpdateGen) : this._lastUpdateGen
    let result = super.mergeAfter(...arguments)
    if (result) {
      if (this._genOlderThan(nodeGen)) {
        this._lastUpdateGen = nodeGen
      }
    }
    return result
  }

  /**
   * Whether the generation of `this` is older than the generation to compare.
   * This method is needed because generation numbers can be cycled.
   *
   * @param {*} generationToComp the generation to be compared
   * @returns {boolean} `true` if `this` is older
   */
  _genOlderThan (generationToComp) {
    return this.tree && this.tree.lifeSpan &&
      generationToComp > this._lastUpdateGen &&
      ((generationToComp <= this.tree._currGen) ===
        (this._lastUpdateGen <= this.tree._currGen)
      )
  }

  /**
   * Let nodes and/or their children that are too old wither
   *    Note that this withering only removes nodes, it does not do any
   *    restructuring that may be required for some trees. The restructuring
   *    needs to happen in the __`GiveTree`__ object calling this.
   *
   * @returns {boolean} `true` if the node itself has withered and should
   *    be removed from its parent.
   */
  wither () {
    // If `this.tree.neighboringLinks === true`, traversing may get around
    //    parents, which may cause the generation of parent nodes to be older
    //    than their offspring, this needs to be corrected first.
    if (this.tree.neighboringLinks) {
      this.values.forEach(value => {
        if (value && typeof value._lastUpdateGen === 'number' &&
          this._genOlderThan(value._lastUpdateGen)
        ) {
          this._lastUpdateGen = value._lastUpdateGen
        }
      })
    }
    // If current node itself withers,
    // it will cause this and *all the children of this* wither
    // NOTE: Root node may also wither, which causes the whole tree to wither
    if (this._shouldWither) {
      this.clear(null)
      return true
    }
    // For children, mark all children that needs to be withered
    // then call `this.delete` on all children marked.
    for (let index = 0; index < this.childNum; index++) {
      let child = this.values[index]
      if (child && typeof child.wither === 'function' && child.wither()) {
        this.remove(child, true, null)
        index--
      }
    }
    return this.childNum <= 1 && this.values[0] === null
  }

  /**
   * Whether `this` should wither according to settings in `this.tree`
   *
   * @readonly
   */
  get _shouldWither () {
    if (!this.tree || !this.tree.lifeSpan) {
      return false
    }
    return !(this.firstChild && this.firstChild._shouldWither === false) && (
      this.tree._currGen >= this._lastUpdateGen
        ? this.tree._currGen - this._lastUpdateGen > this.tree.lifeSpan
        : this.tree._currGen +
          (this.tree.constructor.MAX_GENERATION - this._lastUpdateGen) >
          this.tree.lifeSpan
    )
  }

  /**
   * Refresh the generation of `this` so it will last longer.
   */
  rejuvenate () {
    if (this.tree && this.tree.lifeSpan) {
      this._lastUpdateGen = this.tree._currGen
    }
  }

  traverse (chrRange, callback, filter, breakOnFalse, props, ...args) {
    let result
    if (typeof super.traverse === 'function') {
      result = super.traverse(...arguments)
    }
    if (!props || !props.doNotWither) {
      this.rejuvenate()
    }
    return result
  }

  getUncachedRange (chrRange, props, ...args) {
    let result
    if (typeof super.getUncachedRange === 'function') {
      result = super.getUncachedRange(...arguments)
    }
    if (!props || !props.doNotWither) {
      this.rejuvenate()
    }
    return result
  }
}

module.exports = WitheringMixin
