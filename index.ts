// The background task must be defined before the app starts, so import it first.
import './src/services/background';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
