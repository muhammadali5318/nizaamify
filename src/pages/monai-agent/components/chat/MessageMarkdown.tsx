import React, { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

const MessageMarkdown = ({ message }: { message: string }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        li: ({ children }) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (isElementWithChildren(child) && child.type === 'p') {
              return child.props.children
            }
            return child
          })
          return <li>{processedChildren}</li>
        }
      }}
    >
      {message}
    </ReactMarkdown>
  )
}

function isElementWithChildren(
  child: React.ReactNode
): child is React.ReactElement<{ children?: ReactNode }> {
  return React.isValidElement(child)
}

export default MessageMarkdown
