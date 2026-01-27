import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CollapsibleComponent } from './CollapsibleComponent'

export interface CollapsibleOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collapsible: {
      setCollapsible: () => ReturnType
      toggleCollapsibleOpen: () => ReturnType
    }
  }
}

export const Collapsible = Node.create<CollapsibleOptions>({
  name: 'collapsible',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-open') !== 'false',
        renderHTML: (attributes) => ({
          'data-open': attributes.open ? 'true' : 'false',
        }),
      },
      title: {
        default: 'Toggle',
        parseHTML: (element) => element.getAttribute('data-title') || 'Toggle',
        renderHTML: (attributes) => ({
          'data-title': attributes.title,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-collapsible]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-collapsible': '',
        class: 'collapsible',
      }),
      0,
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleComponent)
  },

  addCommands() {
    return {
      setCollapsible:
        () =>
        ({ commands }) => {
          return commands.wrapIn(this.name, { open: true, title: 'Toggle' })
        },
      toggleCollapsibleOpen:
        () =>
        ({ commands, state }) => {
          const { from } = state.selection
          const node = state.doc.nodeAt(from)
          if (node?.type.name === this.name) {
            return commands.updateAttributes(this.name, { open: !node.attrs.open })
          }
          return false
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-t': () => this.editor.commands.setCollapsible(),
    }
  },
})

export default Collapsible
