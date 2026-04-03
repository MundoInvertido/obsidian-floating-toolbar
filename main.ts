import { App, Editor, MarkdownView, Plugin, PluginSettingTab, setIcon, Setting, FuzzySuggestModal, FuzzyMatch, getIconIds, Command } from 'obsidian';

interface ToolbarCommand {
	id: string;
	label: string;
	icon: string;
	actionType: 'format' | 'command' | 'divider';
	actionValue: string;
	formatBehavior?: 'wrap' | 'prefix';
}

interface FloatingToolbarSettings {
	commands: Array<ToolbarCommand>;
	toolbarWidth: number;
}

const DEFAULT_SETTINGS: FloatingToolbarSettings = {
	toolbarWidth: 250,
	commands: [
		{ id: 'bold', label: 'Negrito', icon: 'bold', actionType: 'format', actionValue: '**', formatBehavior: 'wrap' },
		{ id: 'italic', label: 'Itálico', icon: 'italic', actionType: 'format', actionValue: '*', formatBehavior: 'wrap' },
		{ id: 'highlighter', label: 'Destaque', icon: 'highlighter', actionType: 'format', actionValue: '==', formatBehavior: 'wrap' },
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Migrate older settings
		this.settings.commands.forEach(c => {
			if (c.actionType === 'format' && !c.formatBehavior) c.formatBehavior = 'wrap';
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
						this.applyFormatting(cmd.actionValue, cmd.formatBehavior || 'wrap');
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

	private createButton(iconId: string, ariaLabel: string): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.addClass('floating-toolbar-button');
		btn.setAttribute('aria-label', ariaLabel);
		try {
			setIcon(btn, iconId);
		} catch (e) {
			btn.innerText = '?';
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

	private applyFormatting(wrapper: string, behavior: 'wrap' | 'prefix') {
		if (!this.activeEditor) return;
		const selection = this.activeEditor.getSelection();
		if (!selection) return;

		let newStr = '';
		if (behavior === 'wrap') {
			if (selection.startsWith(wrapper) && selection.endsWith(wrapper)) {
				newStr = selection.slice(wrapper.length, -wrapper.length);
			} else {
				newStr = `${wrapper}${selection}${wrapper}`;
			}
		} else {
			// Prefix
			if (selection.startsWith(wrapper)) {
				newStr = selection.slice(wrapper.length);
			} else {
				newStr = `${wrapper}${selection}`;
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
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl('h2', {text: 'Botões da Barra Flutuante'});

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
						formatBehavior: 'wrap'
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
					.setName(`Ícone Visual: ${cmd.icon}`)
					.setDesc('Escolha dentre os ícones disponíveis no Obsidian.')
					.addButton(btn => btn
						.setButtonText('Escolher Ícone')
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
							if (cmd.actionType === 'format' && !cmd.formatBehavior) {
								cmd.formatBehavior = 'wrap';
							}
							cmd.actionValue = ''; // Clear value to avoid confusion
							await this.plugin.saveSettings();
							this.display();
						}));

				// Sub-configurações baseadas no tipo de ação
				if (cmd.actionType === 'format') {
					new Setting(div)
						.setName('Símbolo de Formatação')
						.setDesc('Exemplo: "**" para negrito ou "-" para lista.')
						.addText(text => text
							.setPlaceholder('Símbolo')
							.setValue(cmd.actionValue)
							.onChange(async (value) => {
								cmd.actionValue = value;
								await this.plugin.saveSettings();
							}));

					new Setting(div)
						.setName('Comportamento')
						.setDesc('O símbolo envolve a palavra interia ou aparece apenas no início?')
						.addDropdown(cb => cb
							.addOption('wrap', 'Envolver Texto (Início e Fim)')
							.addOption('prefix', 'Apenas no Início (Prefixo)')
							.setValue(cmd.formatBehavior || 'wrap')
							.onChange(async (value) => {
								cmd.formatBehavior = value as 'wrap' | 'prefix';
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
