import React, {
  cloneElement,
  Fragment,
  ReactElement,
  ReactNode,
  SyntheticEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import styles from './style.css';
import { addRootElement, createElement } from './lib/generateElement';
import { render as reactRender } from './lib/react-render';
import { createId, isBrowser } from './lib/utils';
import { SET_TIMEOUT_MAX, ToastPosition } from './lib/constants';

type ClickHandler = (e: SyntheticEvent<HTMLDivElement>) => void | Promise<void>;
type Position = (typeof ToastPosition)[keyof typeof ToastPosition];

export interface ToastOptions {
  /**
   * @deprecated The time option is deprecated. Use duration instead.
   */
  time?: number;
  duration?: number;
  className?: string;
  clickable?: boolean;
  clickClosable?: boolean;
  position?: Position;
  maxVisibleToasts?: number | null;
  reverse?: boolean;
  render?: ((message: ReactNode) => ReactNode) | null;
  onClick?: ClickHandler;
  onClose?: () => void;
  onCloseStart?: () => void;
}

export interface ConfigArgs
  extends Pick<
    ToastOptions,
    | 'time'
    | 'duration'
    | 'className'
    | 'clickClosable'
    | 'position'
    | 'maxVisibleToasts'
    | 'reverse'
    | 'render'
  > {}

export interface ToastProps
  extends Pick<
    ToastOptions,
    'className' | 'clickable' | 'position' | 'reverse' | 'render' | 'onClick'
  > {
  message: ReactNode;
  isExit?: boolean;
}

export interface Toast {
  close: () => void;
  updateDuration: (duration?: number) => void;
  update: (message: ReactNode, duration?: number) => void;
}

let toastComponentList: {
  id: number;
  message: ReactNode;
  position: Position;
  component: ReactElement;
  isExit?: boolean;
}[] = [];

const init = () => {
  const toastContainer =
    isBrowser() && document.getElementById(styles['toast_container']);
  if (isBrowser() && !toastContainer) {
    addRootElement(createElement(styles['toast_container']));
  }
  if (!toastComponentList || !Array.isArray(toastComponentList)) {
    toastComponentList = [];
  }
};

const defaultOptions: Required<ConfigArgs> = {
  time: 3000,
  duration: 3000,
  className: '',
  position: 'bottom-center',
  clickClosable: false,
  render: null,
  maxVisibleToasts: null,
  reverse: false,
};

const isValidPosition = (position: Position): boolean => {
  const positionList = Object.values(ToastPosition);
  if (!positionList.includes(position)) {
    throw new Error(
      `Invalid position value. Expected one of ${Object.values(
        ToastPosition,
      ).join(', ')} but got ${position}`,
    );
  }

  return true;
};

export const toastConfig = (options: ConfigArgs) => {
  if (options.time) {
    defaultOptions.time = options.time;
  }
  if (options.duration) {
    defaultOptions.duration = options.duration;
  }
  if (options.className) {
    defaultOptions.className = options.className;
  }
  if (options.position && isValidPosition(options.position)) {
    defaultOptions.position = options.position;
  }
  if (options.clickClosable) {
    defaultOptions.clickClosable = options.clickClosable;
  }
  if (options.render) {
    defaultOptions.render = options.render;
  }
  if (options.maxVisibleToasts) {
    defaultOptions.maxVisibleToasts = options.maxVisibleToasts;
  }
  if (options.reverse) {
    defaultOptions.reverse = options.reverse;
  }
};

const renderDOM = () => {
  if (!isBrowser()) return;
  const toastContainer = document.getElementById(styles['toast_container']);
  if (!toastContainer) return;

  const defaultToastList = Object.values(ToastPosition).reduce(
    (acc, position) => ({
      ...acc,
      [position]: [],
    }),
    {},
  );
  const toastListByPosition = toastComponentList.reduce<
    Record<string, typeof toastComponentList>
  >((acc, toast) => {
    acc[toast.position].push(toast);
    return acc;
  }, defaultToastList);

  const toastListComponent = Object.entries(toastListByPosition).map(
    ([position, toastsByPosition]) => (
      <div
        key={position}
        className={`${styles['toast-list']} ${styles[position]}`}
      >
        {toastsByPosition.map((t) => (
          <Fragment key={t.id}>
            {cloneElement(t.component, {
              isExit: t.isExit,
            })}
          </Fragment>
        ))}
      </div>
    ),
  );

  reactRender(<>{toastListComponent}</>, toastContainer);
};

export const clearToasts = () => {
  toastComponentList.forEach((toast) => (toast.isExit = true));
  renderDOM();
};

const Toast = ({
  message,
  className,
  clickable,
  position,
  isExit,
  reverse,
  render,
  onClick,
}: ToastProps): ReactElement => {
  const messageDOM = useRef<HTMLDivElement>(null);
  const [isEnter, setIsEnter] = useState(false);

  useLayoutEffect(() => {
    if (messageDOM.current && messageDOM.current.clientHeight) {
      const height = messageDOM.current.clientHeight;
      messageDOM.current.style.height = '0px';
      setTimeout(() => {
        if (messageDOM.current) messageDOM.current.style.height = `${height}px`;
        setIsEnter(true);
      }, 0);
    }
  }, []);

  useLayoutEffect(() => {
    const topOrCenter =
      position && (position.indexOf('top') > -1 || position === 'center');
    if (isExit && position && (topOrCenter || reverse)) {
      if (messageDOM.current) messageDOM.current.style.height = '0px';
    }
  }, [isExit]);

  const contentClassNames = [
    styles['toast-content'],
    clickable ? styles['clickable'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const clickableProps = {
    onClick,
    tabIndex: 0,
    role: 'button',
  };

  return (
    <div
      ref={messageDOM}
      className={`${styles['toast-message']} ${
        isEnter ? 'toast-enter-active' : ''
      } ${isExit ? 'toast-exit-active' : ''} ${className}`}
    >
      {render ? (
        <div {...(clickable && clickableProps)}>{render(message)}</div>
      ) : (
        <div className={contentClassNames} {...(clickable && clickableProps)}>
          {message}
        </div>
      )}
    </div>
  );
};

function closeToast(
  id: number,
  options: Pick<ToastOptions, 'onClose' | 'onCloseStart'>,
) {
  const index = toastComponentList.findIndex((t) => t.id === id);
  if (toastComponentList[index]) {
    toastComponentList[index].isExit = true;
  }
  if (options.onCloseStart) {
    options.onCloseStart();
  }
  renderDOM();

  setTimeout(() => {
    toastComponentList = toastComponentList.filter((t) => t.id !== id);
    if (options.onClose) {
      options.onClose();
    }
    renderDOM();
  }, 300);
}

function renderToast(
  message: ReactNode,
  options?: ToastOptions & { toastInstanceId?: number },
): Toast {
  const dummyReturn = {
    close: () => {},
    updateDuration: () => {},
    update: () => {},
  };
  if (!isBrowser()) return dummyReturn;

  let closeTimer: number;
  const id = createId();
  const {
    time = undefined,
    duration,
    clickable = false,
    clickClosable = defaultOptions.clickClosable,
    className = defaultOptions.className,
    position = defaultOptions.position,
    maxVisibleToasts = defaultOptions.maxVisibleToasts,
    reverse = defaultOptions.reverse,
    render = defaultOptions.render,
    onClick = undefined,
    onClose = undefined,
    onCloseStart = undefined,
  } = options || {};
  const durationTime =
    duration || time || defaultOptions.duration || defaultOptions.time;
  const closeOptions = { onClose, onCloseStart };

  if (!isValidPosition(position)) {
    return dummyReturn;
  }

  init();

  const handleClick: ClickHandler = (...args) => {
    if (clickClosable) {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
      closeToast(id, closeOptions);
    }
    if (onClick) onClick(...args);
  };

  const newToastComponent = {
    id,
    message,
    position,
    component: (
      <Toast
        message={message}
        className={className}
        clickable={clickable || clickClosable}
        position={position}
        reverse={reverse}
        render={render}
        onClick={handleClick}
      />
    ),
  };
  if (reverse) toastComponentList.unshift(newToastComponent);
  else toastComponentList.push(newToastComponent);

  if (maxVisibleToasts) {
    const toastsToRemove = toastComponentList.length - maxVisibleToasts;
    for (let i = 0; i < toastsToRemove; i++) {
      closeToast(toastComponentList[i].id, closeOptions);
    }
  }

  renderDOM();

  const startCloseTimer = (duration = durationTime) => {
    if (duration > SET_TIMEOUT_MAX) return;
    if (closeTimer) {
      clearTimeout(closeTimer);
    }
    closeTimer = window.setTimeout(() => {
      closeToast(id, closeOptions);
    }, duration);
  };

  startCloseTimer();

  return {
    close: () => closeToast(id, closeOptions),
    updateDuration: (newDuration = durationTime) => {
      startCloseTimer(newDuration);
    },
    update: (newMessage: ReactNode, newDuration?: number) => {
      const index = toastComponentList.findIndex((t) => t.id === id);
      if (toastComponentList[index]) {
        toastComponentList[index].message = newMessage;
        toastComponentList[index].component = (
          <Toast
            message={newMessage}
            className={className}
            clickable={clickable || clickClosable}
            position={position}
            reverse={reverse}
            render={render}
            onClick={handleClick}
          />
        );
      }
      renderDOM();

      if (newDuration) {
        startCloseTimer(newDuration);
      }
    },
  };
}

function toast(message: ReactNode, duration?: number): Toast;
function toast(message: ReactNode, options?: ToastOptions): Toast;
function toast(
  message: ReactNode,
  durationOrOptions?: number | ToastOptions,
): Toast {
  const options =
    typeof durationOrOptions === 'number'
      ? { duration: durationOrOptions }
      : durationOrOptions;
  return renderToast(message, options);
}

export const createToast = (
  options: Omit<ConfigArgs, 'time'>,
): typeof toast => {
  const toastInstanceId = createId();

  return (message, durationOrOptions) => {
    if (typeof durationOrOptions === 'number') {
      return renderToast(message, {
        toastInstanceId,
        duration: durationOrOptions || options.duration,
      });
    }
    if (
      durationOrOptions === undefined ||
      typeof durationOrOptions === 'object'
    ) {
      const mergedOptions = {
        toastInstanceId,
        ...options,
        ...durationOrOptions,
      };
      return renderToast(message, mergedOptions);
    }

    throw new Error('Invalid durationOrOptions type');
  };
};

export default toast;
