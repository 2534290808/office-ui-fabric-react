import * as React from 'react';
import { IconButton } from '../../Button';
import { Label } from '../../Label';
import { Icon } from '../../Icon';
import {
  BaseComponent,
  css,
  getId,
  KeyCodes,
  autobind
} from '../../Utilities';
import {
  ISpinButton,
  ISpinButtonProps
} from './SpinButton.Props';
import { Position } from '../../utilities/positioning';
import * as stylesImport from './SpinButton.scss';
const styles: any = stylesImport;

export enum KeyboardSpinDirection {
  down = -1,
  notSpinning = 0,
  up = 1
}

export interface ISpinButtonState {
  /**
   * the value of the spin button
   */
  value?: string;

  /**
   * keyboard spin direction, used to style the up or down button
   * as active when up/down arrow is pressed
   */
  keyboardSpinDirection?: KeyboardSpinDirection;
}

export class SpinButton extends BaseComponent<ISpinButtonProps, ISpinButtonState> implements ISpinButton {

  public static defaultProps: ISpinButtonProps = {
    step: 1,
    min: 0,
    max: 100,
    disabled: false,
    labelPosition: Position.start,
    label: null,
    incrementButtonIcon: { iconName: 'ChevronUpSmall' },
    decrementButtonIcon: { iconName: 'ChevronDownSmall' }
  };

  private _input: HTMLInputElement;
  private _inputId: string;
  private _labelId: string;
  private _lastValidValue: string;
  private _spinningByMouse: boolean;

  private _onValidate?: (value: string) => string | void;
  private _onIncrement?: (value: string) => string | void;
  private _onDecrement?: (value: string) => string | void;

  private _currentStepFunctionHandle: number;
  private _stepDelay = 100;
  private _formattedValidUnitOptions: string[] = [];
  private _arrowButtonStyle: React.CSSProperties = {
    icon: {
      fontSize: '6px',
    }
  };

  constructor(props: ISpinButtonProps) {
    super(props);

    this._warnMutuallyExclusive({
      'value': 'defaultValue'
    });

    let value = props.value || props.defaultValue || String(props.min);
    this._lastValidValue = value;

    this.state = {
      value: value,
      keyboardSpinDirection: KeyboardSpinDirection.notSpinning
    };

    this._currentStepFunctionHandle = -1;
    this._labelId = getId('Label');
    this._inputId = getId('input');
    this._spinningByMouse = false;

    if (props.defaultValue) {
      this._onValidate = this._defaultOnValidate;
      this._onIncrement = this._defaultOnIncrement;
      this._onDecrement = this._defaultOnDecrement;
    } else {
      this._onValidate = props.onValidate;
      this._onIncrement = props.onIncrement;
      this._onDecrement = props.onDecrement;
    }

    this.focus = this.focus.bind(this);
  }

  /**
  * Invoked when a component is receiving new props. This method is not called for the initial render.
  */
  public componentWillReceiveProps(newProps: ISpinButtonProps): void {
    this._lastValidValue = this.state.value;
    let value: string = newProps.value ? newProps.value : String(newProps.min);
    if (newProps.defaultValue) {
      value = String(Math.max(newProps.min, Math.min(newProps.max, Number(newProps.defaultValue))));
    }

    this.setState({
      value: value
    });
  }

  public render() {
    const {
      disabled,
      label,
      min,
      max,
      labelPosition,
      iconProps,
      incrementButtonIcon,
      decrementButtonIcon,
      title,
      ariaLabel
    } = this.props;

    const {
      value,
      keyboardSpinDirection
    } = this.state;

    return (
      <div className={ styles.SpinButtonContainer }>
        { labelPosition !== Position.bottom && <div className={ css(styles.labelWrapper, this._getClassNameForLabelPosition(labelPosition)) }>
          { iconProps && <Icon iconName={ iconProps.iconName } className={ css(styles.SpinButtonIcon) } aria-hidden='true'></Icon> }
          { label &&
            <Label
              id={ this._labelId }
              htmlFor={ this._inputId }
              className={ styles.SpinButtonLabel }>{ label }
            </Label>
          }
        </div> }
        <div
          className={ css(styles.SpinButtonWrapper, ((labelPosition === Position.top || labelPosition === Position.bottom) ? styles.topBottom : '')) }
          title={ title && title }
          aria-label={ ariaLabel && ariaLabel }
        >
          <input
            value={ value }
            id={ this._inputId }
            onChange={ this._onChange }
            onInput={ this._onInputChange }
            className={ css(styles.Input, (disabled ? styles.disabled : '')) }
            type='text'
            role='spinbutton'
            aria-labelledby={ label && this._labelId }
            aria-valuenow={ value }
            aria-valuemin={ min && String(min) }
            aria-valuemax={ max && String(max) }
            onBlur={ this._validate }
            ref={ this._resolveRef('_input') }
            onFocus={ this.focus }
            onKeyDown={ this._handleKeyDown }
            onKeyUp={ this._handleKeyUp }
            readOnly={ disabled }
            aria-disabled={ disabled }
          />
          <span className={ styles.ArrowBox }>
            <IconButton
              className={ css('ms-UpButton', styles.UpButton, (keyboardSpinDirection === KeyboardSpinDirection.up ? styles.active : '')) }
              styles={ this._arrowButtonStyle }
              disabled={ disabled }
              iconProps={ incrementButtonIcon }
              aria-hidden='true'
              onMouseDown={ () => this._onIncrementMouseDown() }
              onMouseLeave={ this._stop }
              onMouseUp={ this._stop }
              tabIndex={ -1 }
            />
            <IconButton
              className={ css('ms-DownButton', styles.DownButton, (keyboardSpinDirection === KeyboardSpinDirection.down ? styles.active : '')) }
              styles={ this._arrowButtonStyle }
              disabled={ disabled }
              iconProps={ decrementButtonIcon }
              aria-hidden='true'
              onMouseDown={ () => this._onDecrementMouseDown() }
              onMouseLeave={ this._stop }
              onMouseUp={ this._stop }
              tabIndex={ -1 }
            />
          </span>
        </div>
        { labelPosition === Position.bottom && <div className={ css(styles.labelWrapper, this._getClassNameForLabelPosition(labelPosition)) }>
          { iconProps && <Icon iconName={ iconProps.iconName } className={ css(styles.SpinButtonIcon) } aria-hidden='true'></Icon> }
          { label &&
            <Label
              id={ this._labelId }
              htmlFor={ this._inputId }
              className={ styles.SpinButtonLabel }>{ label }
            </Label>
          }
        </div>
        }
      </div>
    );
  }

  /**
   * OnFocus select the contents of the input
   */
  public focus() {
    if (this._spinningByMouse || this.state.keyboardSpinDirection !== KeyboardSpinDirection.notSpinning) {
      this._stop();
    }

    this._input.focus();
    this._input.select();
  }

  /**
   * Validate function to use if one is not passed in
   */
  private _defaultOnValidate = (value: string) => {
    if (isNaN(Number(value))) {
      return this._lastValidValue;
    }
    const newValue = Math.min(this.props.max, Math.max(this.props.min, Number(value)));
    return String(newValue);
  }

  /**
   * Increment function to use if one is not passed in
   */
  private _defaultOnIncrement = (value: string) => {
    let newValue = Math.min(Number(value) + this.props.step, this.props.max);
    return String(newValue);
  }

  /**
   * Increment function to use if one is not passed in
   */
  private _defaultOnDecrement = (value: string) => {
    let newValue = Math.max(Number(value) - this.props.step, this.props.min);
    return String(newValue);
  }

  /**
   * Returns the class name corresponding to the label position
   */
  private _getClassNameForLabelPosition(labelPosition: Position): string {
    let className: string = '';

    switch (labelPosition) {
      case Position.start:
        className = styles.start;
        break;
      case Position.end:
        className = styles.end;
        break;
      case Position.top:
        className = styles.top;
        break;
      case Position.bottom:
        className = styles.bottom;
    }

    return className;
  }

  private _onChange() {
    /**
     * A noop input change handler.
     * https://github.com/facebook/react/issues/7027.
     * Using the native onInput handler fixes the issue but onChange
     * still need to be wired to avoid React console errors
     * TODO: Check if issue is resolved when React 16 is available.
     */
  }

  /**
   * This is used when validating text entry
   * in the input (not when changed via the buttons)
   * @param event - the event that fired
   */
  @autobind
  private _validate(event: React.FocusEvent<HTMLInputElement>) {
    const element: HTMLInputElement = event.target as HTMLInputElement;
    const value: string = element.value;
    if (this.state.value) {
      const newValue = this._onValidate(value);
      if (newValue) {
        this._lastValidValue = newValue;
        this.setState({ value: newValue });
      }
    }
  }

  /**
   * The method is needed to ensure we are updating the actual input value.
   * without this our value will never change (and validation will not have the correct number)
   * @param event - the event that was fired
   */
  @autobind
  private _onInputChange(event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>): void {
    const element: HTMLInputElement = event.target as HTMLInputElement;
    const value: string = element.value;

    this.setState({
      value: value,
    });
  }

  /**
   * Update the value with the given stepFunction
   * @param shouldSpin - should we fire off another updateValue when we are done here? This should be true
   * when spinning in response to a mouseDown
   * @param stepFunction - function to use to step by
   */
  @autobind
  private _updateValue(shouldSpin: boolean, stepFunction: (string) => string | void) {
    const newValue = stepFunction(this.state.value);
    if (newValue) {
      this._lastValidValue = newValue;
      this.setState({ value: newValue });
    }

    if (this._spinningByMouse !== shouldSpin) {
      this._spinningByMouse = shouldSpin;
    }

    if (shouldSpin) {
      this._currentStepFunctionHandle = this._async.setTimeout(() => { this._updateValue(shouldSpin, stepFunction); }, this._stepDelay);
    }
  }

  /**
   * Stop spinning (clear any currently pending update and set spinning to false)
   */
  @autobind
  private _stop() {
    if (this._currentStepFunctionHandle >= 0) {
      this._async.clearTimeout(this._currentStepFunctionHandle);
      this._currentStepFunctionHandle = -1;
    }

    if (this._spinningByMouse || this.state.keyboardSpinDirection !== KeyboardSpinDirection.notSpinning) {
      this._spinningByMouse = false;
      this.setState({ keyboardSpinDirection: KeyboardSpinDirection.notSpinning });
    }
  }

  /**
   * Handle keydown on the text field. We need to update
   * the value when up or down arrow are depressed
   * @param event - the keyboardEvent that was fired
   */
  @autobind
  private _handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (this.props.disabled) {
      this._stop();

      // eat the up and down arrow keys to keep the page from scrolling
      if (event.which === KeyCodes.up || event.which === KeyCodes.down) {
        event.preventDefault();
        event.stopPropagation();
      }

      return;
    }

    let spinDirection = KeyboardSpinDirection.notSpinning;

    if (event.which === KeyCodes.up) {

      spinDirection = KeyboardSpinDirection.up;
      this._updateValue(false /* shouldSpin */, this._onIncrement);
    } else if (event.which === KeyCodes.down) {

      spinDirection = KeyboardSpinDirection.down;
      this._updateValue(false /* shouldSpin */, this._onDecrement);
    } else if (event.which === KeyCodes.enter) {
      event.currentTarget.blur();
      this.focus();
    } else if (event.which === KeyCodes.escape) {
      if (this.state.value !== this._lastValidValue) {
        this.setState({ value: this._lastValidValue });
      }
    }

    // style the increment/decrement button to look active
    // when the corresponding up/down arrow keys trigger a step
    if (this.state.keyboardSpinDirection !== spinDirection) {
      this.setState({ keyboardSpinDirection: spinDirection });
    }
  }

  /**
   * Make sure that we have stopped spinning on keyUp
   * if the up or down arrow fired this event
   * @param event stop spinning if we
   */
  @autobind
  private _handleKeyUp(event: React.KeyboardEvent<HTMLElement>) {

    if (this.props.disabled || event.which === KeyCodes.up || event.which === KeyCodes.down) {
      this._stop();
      return;
    }
  }

  @autobind
  private _onIncrementMouseDown() {
    this._updateValue(true /* shouldSpin */, this._onIncrement);
  }

  @autobind
  private _onDecrementMouseDown() {
    this._updateValue(true /* shouldSpin */, this._onDecrement);
  }

}