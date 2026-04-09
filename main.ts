import { App, Editor, MarkdownView, Plugin, PluginSettingTab, setIcon, Setting, FuzzySuggestModal, FuzzyMatch, getIconIds, Command } from 'obsidian';

interface ToolbarCommand {
	id: string;
	label: string;
	icon: string;
	actionType: 'format' | 'command' | 'divider';
	actionValue: string; // command ID or Prefix
	formatSuffix?: string; // Suffix
}

interface FloatingToolbarSettings {
	commands: Array<ToolbarCommand>;
	toolbarWidth: number;
}

const DEFAULT_SETTINGS: FloatingToolbarSettings = {
	toolbarWidth: 250,
	commands: [
		{ id: 'bold', label: 'Negrito', icon: 'bold', actionType: 'format', actionValue: '**', formatSuffix: '**' },
		{ id: 'italic', label: 'Itálico', icon: 'italic', actionType: 'format', actionValue: '*', formatSuffix: '*' },
		{ id: 'highlighter', label: 'Destaque', icon: 'highlighter', actionType: 'format', actionValue: '==', formatSuffix: '==' },
		{ id: 'div1', label: '', icon: '', actionType: 'divider', actionValue: '' },
		{ id: 'list', label: 'Marcador', icon: 'list', actionType: 'command', actionValue: 'editor:toggle-bullet-list' },
		{ id: 'indent', label: 'Deslocar para Frente', icon: 'indent', actionType: 'command', actionValue: 'editor:indent-list' },
		{ id: 'outdent', label: 'Deslocar para Trás', icon: 'outdent', actionType: 'command', actionValue: 'editor:unindent-list' },
		{ id: 'div2', label: '', icon: '', actionType: 'divider', actionValue: '' },
		{ id: 'cmd', label: 'Paleta de Comandos', icon: 'terminal', actionType: 'command', actionValue: 'editor:open-command-palette' },
	]
}

export class CommandSuggestModal extends FuzzySuggestModal<Command> {
	onChoose: (item: Command) => void;

	constructor(app: App, onChoose: (item: Command) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("Pesquise um comando...");
	}

	getItems(): Command[] {
		// @ts-ignore
		return Object.values(this.app.commands.commands);
	}

	getItemText(item: Command): string {
		return item.name;
	}

	onChooseItem(item: Command, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(item);
	}
}

export class IconSuggestModal extends FuzzySuggestModal<string> {
	onChoose: (item: string) => void;

	constructor(app: App, onChoose: (item: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder("Busque um ícone...");
	}

	getItems(): string[] {
		return getIconIds();
	}

	getItemText(item: string): string {
		return item;
	}

	renderSuggestion(item: FuzzyMatch<string>, el: HTMLElement) {
		el.addClass("icon-suggest-item");
		el.style.display = "flex";
		el.style.alignItems = "center";
		el.style.gap = "10px";

		const iconEl = el.createSpan();
		setIcon(iconEl, item.item);
		el.createSpan({ text: item.item });
	}

	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(item);
	}
}

export default class FloatingToolbarPlugin extends Plugin {
	settings: FloatingToolbarSettings;
	private toolbarEl: HTMLElement | null = null;
	private activeEditor: Editor | null = null;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new FloatingToolbarSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on('editor-change', (editor: Editor, view: MarkdownView) => {
				this.handleSelection(editor);
			})
		);

		this.registerDomEvent(document, 'mouseup', (evt: MouseEvent) => {
			// Ignorar clique com botão direito (context menu)
			if (evt.button === 2) return;

			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view && view.editor) {
				setTimeout(() => this.handleSelection(view.editor), 50);
			} else {
				this.hideToolbar();
			}
		});

		this.registerDomEvent(document, 'mousedown', (evt: MouseEvent) => {
			if (this.toolbarEl && !this.toolbarEl.contains(evt.target as Node)) {
				this.hideToolbar();
			}
		});

		this.createToolbar();
	}

	onunload() {
		this.hideToolbar();
		if (this.toolbarEl) {
			this.toolbarEl.remove();
		}
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		// Migrate older settings (formatBehavior to formatSuffix)
		this.settings.commands.forEach((c: any) => {
			if (c.actionType === 'format' && c.formatSuffix === undefined) {
				if (c.formatBehavior === 'wrap') {
					c.formatSuffix = c.actionValue;
				} else {
					c.formatSuffix = '';
				}
				delete c.formatBehavior;
			}
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.rebuildToolbar();
	}

	public rebuildToolbar() {
		if (this.toolbarEl) {
			this.toolbarEl.remove();
		}
		this.createToolbar();
	}

	private createToolbar() {
		this.toolbarEl = document.createElement('div');
		this.toolbarEl.addClass('floating-toolbar');
		document.body.appendChild(this.toolbarEl);

		this.settings.commands.forEach(cmd => {
			if (cmd.actionType === 'divider') {
				const divider = document.createElement('div');
				divider.addClass('floating-toolbar-divider');
				this.toolbarEl?.appendChild(divider);
			} else {
				const btn = this.createButton(cmd.icon, cmd.label);
				btn.onclick = (e) => {
					e.preventDefault();
					if (cmd.actionType === 'format') {
						this.applyFormatting(cmd.actionValue, cmd.formatSuffix || '');
					} else if (cmd.actionType === 'command') {
						// @ts-ignore
						this.app.commands.executeCommandById(cmd.actionValue);

						if (!cmd.actionValue.includes('indent')) {
							this.hideToolbar();
						}
					}
				};
				this.toolbarEl?.appendChild(btn);
			}
		});

		this.toolbarEl.addEventListener('mousedown', (e) => {
			e.preventDefault();
		});
	}

	private createButton(icon: string, ariaLabel: string): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.addClass('floating-toolbar-button');
		btn.setAttribute('aria-label', ariaLabel);
		
		const cleanIcon = icon.trim();
		
		if (cleanIcon.startsWith('<svg')) {
			try {
				const wrapper = document.createElement('div');
				wrapper.innerHTML = cleanIcon;
				const svgEl = wrapper.firstElementChild;
				if (svgEl && svgEl.tagName.toLowerCase() === 'svg') {
					btn.appendChild(svgEl);
				} else {
					btn.innerText = '?';
				}
			} catch(e) {
				btn.innerText = '!';
			}
		} else {
			const validIcons = getIconIds();
			if (validIcons.includes(cleanIcon)) {
				try {
					setIcon(btn, cleanIcon);
				} catch (e) {
					btn.innerText = '?';
				}
			} else {
				// Trata como Emoji ou Texto customizado
				btn.innerText = cleanIcon;
			}
		}
		return btn;
	}

	private handleSelection(editor: Editor) {
		const selection = editor.getSelection();
		if (selection && selection.length > 0) {
			this.activeEditor = editor;
			this.showToolbar();
		} else {
			this.hideToolbar();
		}
	}

	private showToolbar() {
		if (!this.toolbarEl || !this.activeEditor) return;

		const domSelection = window.getSelection();
		if (!domSelection || domSelection.rangeCount === 0) return;

		const range = domSelection.getRangeAt(0);
		const rect = range.getBoundingClientRect();

		if (rect.width === 0 && rect.height === 0) return;

		const widthEst = this.settings.commands.reduce((acc, c) => acc + (c.actionType === 'divider' ? 10 : 36), 0) + 12; // 12 for padding
		const toolbarWidth = widthEst > 100 ? widthEst : 150;
		const toolbarHeight = 40;

		let top = rect.top - toolbarHeight - 10;
		let left = rect.left + (rect.width / 2) - (toolbarWidth / 2);

		if (top < 0) top = rect.bottom + 10;
		if (left < 0) left = 10;
		if (left + toolbarWidth > window.innerWidth) left = window.innerWidth - toolbarWidth - 10;

		this.toolbarEl.style.top = `${top}px`;
		this.toolbarEl.style.left = `${left}px`;
		this.toolbarEl.addClass('is-visible');
	}

	private hideToolbar() {
		if (this.toolbarEl) {
			this.toolbarEl.removeClass('is-visible');
		}
		this.activeEditor = null;
	}

	private applyFormatting(prefix: string, suffix: string) {
		if (!this.activeEditor) return;
		const selection = this.activeEditor.getSelection();
		if (!selection) return;

		let newStr = '';
		if (suffix) {
			// Wrap / Asymmetric wrap
			if (selection.startsWith(prefix) && selection.endsWith(suffix)) {
				newStr = selection.slice(prefix.length, -suffix.length);
			} else {
				newStr = `${prefix}${selection}${suffix}`;
			}
		} else {
			// Prefix only
			if (selection.startsWith(prefix)) {
				newStr = selection.slice(prefix.length);
			} else {
				newStr = `${prefix}${selection}`;
			}
		}

		this.activeEditor.replaceSelection(newStr);

		setTimeout(() => {
			if (this.activeEditor) {
				this.handleSelection(this.activeEditor);
				this.activeEditor.focus();
			}
		}, 50);
	}
}

class FloatingToolbarSettingTab extends PluginSettingTab {
	plugin: FloatingToolbarPlugin;

	constructor(app: App, plugin: FloatingToolbarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Botões da Barra Flutuante' });

		new Setting(containerEl)
			.setName('Adicionar Comando')
			.setDesc('Adicione um novo botão à barra flutuante.')
			.addButton(btn => btn
				.setButtonText('Novo Botão')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.commands.push({
						id: Date.now().toString(),
						label: 'Novo Comando',
						icon: 'star',
						actionType: 'format',
						actionValue: '',
						formatSuffix: ''
					});
					await this.plugin.saveSettings();
					this.display();
				}));

		this.plugin.settings.commands.forEach((cmd, index) => {
			const div = containerEl.createDiv('setting-item-group');
			div.style.border = '1px solid var(--background-modifier-border)';
			div.style.padding = '10px';
			div.style.marginTop = '10px';
			div.style.borderRadius = '8px';
			div.style.position = 'relative';

			if (cmd.actionType === 'divider') {
				new Setting(div)
					.setName(`Divisor (Índice ${index + 1})`)
					.addButton(btn => btn
						.setIcon('arrow-up')
						.setTooltip('Mover para cima')
						.setDisabled(index === 0)
						.onClick(async () => { this.moveCommand(index, -1); })
					)
					.addButton(btn => btn
						.setIcon('arrow-down')
						.setTooltip('Mover para baixo')
						.setDisabled(index === this.plugin.settings.commands.length - 1)
						.onClick(async () => { this.moveCommand(index, 1); })
					)
					.addButton(btn => btn
						.setIcon('trash')
						.setTooltip('Remover')
						.onClick(async () => { this.removeCommand(index); })
					);
			} else {
				// Rótulo
				new Setting(div)
					.setName(`Rótulo: ${cmd.label || 'Sem Rótulo'}`)
					.setDesc('Aparece ao passar o mouse por cima do botão.')
					.addText(text => text
						.setPlaceholder('Rótulo (Tooltip)')
						.setValue(cmd.label)
						.onChange(async (value) => {
							cmd.label = value;
							await this.plugin.saveSettings();
						}));

				// Ícone
				new Setting(div)
					.setName(`Ícone Visual`)
					.setDesc('Cole o código <svg> diretamente, digite o nome nativo ou use o botão para escolher no catálogo.')
					.addTextArea(text => text
						.setPlaceholder('Lucide ou <svg xmlns=...>')
						.setValue(cmd.icon)
						.onChange(async (value) => {
							cmd.icon = value;
							await this.plugin.saveSettings();
						}))
					.addButton(btn => btn
						.setButtonText('Catálogo')
						.onClick(() => {
							const modal = new IconSuggestModal(this.app, async (selected) => {
								cmd.icon = selected;
								await this.plugin.saveSettings();
								this.display();
							});
							modal.open();
						})
					);

				// Tipo de Ação e Valor Dinâmico
				const actionSetting = new Setting(div)
					.setName('Configuração de Ação')
					.setDesc('Pode ser Formatação (Markdown) ou um Comando nativo do Obsidian.')
					.addDropdown(cb => cb
						.addOption('format', 'Formatação')
						.addOption('command', 'Comando Nativo')
						.setValue(cmd.actionType)
						.onChange(async (value) => {
							cmd.actionType = value as any;
							if (cmd.actionType === 'format' && cmd.formatSuffix === undefined) {
								cmd.formatSuffix = '';
							}
							cmd.actionValue = ''; // Clear value to avoid confusion
							await this.plugin.saveSettings();
							this.display();
						}));

				// Sub-configurações baseadas no tipo de ação
				if (cmd.actionType === 'format') {
					new Setting(div)
						.setName('Símbolos de Formatação')
						.setDesc('Defina como o texto será envolvido. Deixe o sufixo vazio se quiser apenas aplicar no início.')
						.addText(text => text
							.setPlaceholder('Prefixo (ex: <mark>)')
							.setValue(cmd.actionValue)
							.onChange(async (value) => {
								cmd.actionValue = value;
								await this.plugin.saveSettings();
							}))
						.addText(text => text
							.setPlaceholder('Sufixo (ex: </mark>)')
							.setValue(cmd.formatSuffix || '')
							.onChange(async (value) => {
								cmd.formatSuffix = value;
								await this.plugin.saveSettings();
							}));
				} else if (cmd.actionType === 'command') {
					new Setting(div)
						.setName(`Comando Escolhido`)
						.setDesc(cmd.actionValue || 'Nenhum comando selecionado.')
						.addButton(btn => btn
							.setButtonText(cmd.actionValue ? 'Trocar Comando' : 'Selecionar Comando')
							.setCta()
							.onClick(() => {
								const modal = new CommandSuggestModal(this.app, async (selectedCommand) => {
									cmd.actionValue = selectedCommand.id;
									cmd.label = selectedCommand.name; // Auto-update label
									await this.plugin.saveSettings();
									this.display();
								});
								modal.open();
							})
						);
				}

				// Botões de Movimento e Remoção
				const actionContainer = div.createDiv('setting-item-control');
				actionContainer.style.justifyContent = 'flex-end';
				actionContainer.style.marginTop = '10px';

				const upBtn = actionContainer.createEl('button', { cls: 'mod-cta' });
				setIcon(upBtn, 'arrow-up');
				upBtn.onclick = () => this.moveCommand(index, -1);
				if (index === 0) upBtn.disabled = true;

				const downBtn = actionContainer.createEl('button', { cls: 'mod-cta' });
				setIcon(downBtn, 'arrow-down');
				downBtn.onclick = () => this.moveCommand(index, 1);
				if (index === this.plugin.settings.commands.length - 1) downBtn.disabled = true;

				const delBtn = actionContainer.createEl('button', { cls: 'mod-warning' });
				setIcon(delBtn, 'trash');
				delBtn.onclick = () => this.removeCommand(index);
			}
		});

		new Setting(containerEl)
			.setName('Adicionar Separador')
			.setDesc('Adicione uma linha vertical para organizar os botões.')
			.addButton(btn => btn
				.setButtonText('Novo Separador')
				.onClick(async () => {
					this.plugin.settings.commands.push({
						id: Date.now().toString(),
						label: '',
						icon: '',
						actionType: 'divider',
						actionValue: ''
					});
					await this.plugin.saveSettings();
					this.display();
				}));
	}

	async moveCommand(index: number, direction: number) {
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= this.plugin.settings.commands.length) return;

		const temp = this.plugin.settings.commands[newIndex];
		this.plugin.settings.commands[newIndex] = this.plugin.settings.commands[index];
		this.plugin.settings.commands[index] = temp;

		await this.plugin.saveSettings();
		this.display();
	}

	async removeCommand(index: number) {
		this.plugin.settings.commands.splice(index, 1);
		await this.plugin.saveSettings();
		this.display();
	}
}
