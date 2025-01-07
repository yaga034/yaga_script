# 左にあるカスタムメニューを作成
toolbar = nuke.toolbar("Nodes")
custom_menu = toolbar.addMenu("Custom Tools")

# Tab呼び出しメニューを作成
my_tools_menu = nuke.menu('Nodes').addMenu('Gizmos')
my_tools_menu.addCommand('deep_saturation', 'nuke.createNode("Deep_Saturation")')