import React from 'react';
import { Menu } from '@mantine/core';
import { IconTrash, IconEyeOff, IconFocus2, IconReplace, IconEye } from '@tabler/icons-react';

interface SelectionContextMenuProps {
  opened: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onDelete: () => void;
  onHide: () => void;
  onIsolate: () => void;
  onInvert: () => void;
  onShowAll?: () => void;
  hasHidden: boolean;
}

export function SelectionContextMenu({
  opened,
  position,
  onClose,
  onDelete,
  onHide,
  onIsolate,
  onInvert,
  onShowAll,
  hasHidden,
}: SelectionContextMenuProps) {
  if (!opened) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10000,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Menu
        opened={opened}
        onChange={onClose}
        withArrow
        shadow="md"
        position="right-start"
      >
        <Menu.Target>
          <div style={{ width: 0, height: 0 }} />
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Действия с выделением</Menu.Label>
          
          <Menu.Item
            leftSection={<IconTrash size={16} />}
            color="red"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Удалить
          </Menu.Item>

          <Menu.Item
            leftSection={<IconEyeOff size={16} />}
            onClick={() => {
              onHide();
              onClose();
            }}
          >
            Скрыть
          </Menu.Item>

          <Menu.Item
            leftSection={<IconFocus2 size={16} />}
            onClick={() => {
              onIsolate();
              onClose();
            }}
          >
            Изолировать
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconReplace size={16} />}
            color="violet"
            onClick={() => {
              onInvert();
              onClose();
            }}
          >
            Инвертировать
          </Menu.Item>

          {hasHidden && onShowAll && (
            <>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconEye size={16} />}
                color="green"
                onClick={() => {
                  onShowAll();
                  onClose();
                }}
              >
                Показать всё
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}



